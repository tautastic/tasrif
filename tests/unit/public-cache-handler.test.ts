import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import PublicCacheHandler, {
  collectTags,
  isStorable,
  MemoryCacheStore,
  measureBytes,
  resetSharedStore,
} from "~/server/cache/handler";

const page = (html: string, status?: number, tags = "_N_T_/layout,_N_T_/entry/book") => ({
  kind: "APP_PAGE",
  html,
  rscData: Buffer.from(html),
  headers: { "x-next-cache-tags": tags },
  ...(status === undefined ? {} : { status }),
});

const fetchValue = (body: string) => ({
  kind: "FETCH",
  data: { headers: {}, body, status: 200, url: "" },
  revalidate: 60,
});

beforeEach(() => {
  resetSharedStore();
});

test("only 200 responses of known kinds are storable", () => {
  assert.equal(isStorable(page("ok")), true);
  assert.equal(isStorable(page("ok", 200)), true);
  assert.equal(isStorable(page("missing", 404)), false);
  assert.equal(isStorable(page("boom", 500)), false);
  assert.equal(isStorable(page("moved", 307)), false);
  assert.equal(isStorable({ kind: "APP_ROUTE", body: Buffer.from("x"), status: 404 }), false);
  assert.equal(isStorable({ kind: "REDIRECT", props: {} }), false);
  assert.equal(isStorable({ kind: "IMAGE" }), false);
  assert.equal(isStorable(fetchValue("{}")), true);
  assert.equal(isStorable(null), false);
  assert.equal(isStorable("text"), false);
});

test("a 404 result is never stored and replaces an older cached 200 for the same key", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await handler.set("/entry/a", page("ok"), {});
  assert.ok(await handler.get("/entry/a", { kind: "APP_PAGE" }));
  await handler.set("/entry/a", page("gone", 404), {});
  assert.equal(await handler.get("/entry/a", { kind: "APP_PAGE" }), null);
  await handler.set("/entry/random", page("gone", 404), {});
  assert.equal(await handler.get("/entry/random", { kind: "APP_PAGE" }), null);
});

test("a flood of 404 results does not grow the store or evict valid pages", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 4096 });
  await handler.set("/entry/book", page("ok"), {});
  for (let index = 0; index < 5000; index++) {
    await handler.set(`/entry/junk-${index}`, page("x".repeat(500), 404), {});
  }
  assert.ok(await handler.get("/entry/book", { kind: "APP_PAGE" }));
});

test("get returns the stored value with its last modified time", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  const before = performance.timeOrigin + performance.now();
  const value = page("ok");
  await handler.set("/entry/book", value, {});
  const hit = await handler.get("/entry/book", { kind: "APP_PAGE" });
  assert.ok(hit);
  assert.equal(hit.value, value);
  assert.ok(hit.lastModified >= before);
  assert.equal(await handler.get("/entry/other", { kind: "APP_PAGE" }), null);
});

test("revalidateTag with the layout tag from revalidatePath drops every page carrying it", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await handler.set("/entry/a", page("a", undefined, "_N_T_/layout,_N_T_/entry/a"), {});
  await handler.set("/entry/b", page("b", undefined, "_N_T_/layout,_N_T_/entry/b"), {});
  await handler.set("/other", page("c", undefined, "_N_T_/other"), {});
  await handler.revalidateTag("_N_T_/layout");
  assert.equal(await handler.get("/entry/a", { kind: "APP_PAGE" }), null);
  assert.equal(await handler.get("/entry/b", { kind: "APP_PAGE" }), null);
  assert.ok(await handler.get("/other", { kind: "APP_PAGE" }));
});

test("revalidateTag accepts several tags and ignores unknown ones", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await handler.set("/entry/a", page("a", undefined, "_N_T_/entry/a"), {});
  await handler.set("/entry/b", page("b", undefined, "_N_T_/entry/b"), {});
  await handler.revalidateTag(["_N_T_/entry/a", "_N_T_/never-used"], { expire: 0 });
  assert.equal(await handler.get("/entry/a", { kind: "APP_PAGE" }), null);
  assert.ok(await handler.get("/entry/b", { kind: "APP_PAGE" }));
});

test("an entry written after the revalidation is served again", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await handler.set("/entry/a", page("old", undefined, "_N_T_/layout"), {});
  await handler.revalidateTag("_N_T_/layout");
  assert.equal(await handler.get("/entry/a", { kind: "APP_PAGE" }), null);
  const fresh = page("new", undefined, "_N_T_/layout");
  await handler.set("/entry/a", fresh, {});
  const hit = await handler.get("/entry/a", { kind: "APP_PAGE" });
  assert.ok(hit);
  assert.equal(hit.value, fresh);
});

test("fetch entries are dropped by their own tags and by the soft tags of the reading request", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await handler.set("k1", fetchValue("[1]"), { tags: ["public-data"] });
  await handler.set("k2", fetchValue("[2]"), { tags: ["other"] });
  assert.ok(await handler.get("k1", { kind: "FETCH", tags: ["public-data"], softTags: ["_N_T_/layout"] }));
  await handler.revalidateTag("public-data");
  assert.equal(await handler.get("k1", { kind: "FETCH", tags: ["public-data"] }), null);
  assert.ok(await handler.get("k2", { kind: "FETCH", tags: ["other"], softTags: ["_N_T_/layout"] }));
  await handler.revalidateTag("_N_T_/layout");
  assert.equal(await handler.get("k2", { kind: "FETCH", tags: ["other"], softTags: ["_N_T_/layout"] }), null);
});

test("the least recently used entry is evicted first and total bytes stay under the limit", async () => {
  const entryBytes = measureBytes(page("x".repeat(1000))) + "/entry/aa".length * 2;
  const limit = entryBytes * 3 + 10;
  const store = new MemoryCacheStore(limit);
  for (const key of ["/entry/aa", "/entry/bb", "/entry/cc"]) {
    assert.equal(store.set(key, page("x".repeat(1000)), []), true);
  }
  assert.ok(store.get("/entry/aa"));
  assert.equal(store.set("/entry/dd", page("x".repeat(1000)), []), true);
  assert.deepEqual(store.keys().sort(), ["/entry/aa", "/entry/cc", "/entry/dd"]);
  assert.ok(store.bytes <= limit);
  for (let index = 0; index < 200; index++) {
    store.set(`/entry/k${index}`, page("x".repeat(1000)), []);
    assert.ok(store.bytes <= limit);
  }
  assert.ok(store.size <= 3);
});

test("an entry larger than the whole budget is not stored and a zero budget stores nothing", async () => {
  const small = new MemoryCacheStore(100);
  assert.equal(small.set("/big", page("x".repeat(1000)), []), false);
  assert.equal(small.size, 0);
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 0 });
  await handler.set("/entry/a", page("a"), {});
  assert.equal(await handler.get("/entry/a", { kind: "APP_PAGE" }), null);
});

test("every handler instance shares one store", async () => {
  const writer = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  const reader = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await writer.set("/entry/a", page("a"), {});
  assert.ok(await reader.get("/entry/a", { kind: "APP_PAGE" }));
});

test("collectTags merges the context tags with the cache tags header", () => {
  assert.deepEqual(collectTags(page("a", undefined, "_N_T_/layout,_N_T_/entry/a,"), { tags: ["public-data"] }).sort(), [
    "_N_T_/entry/a",
    "_N_T_/layout",
    "public-data",
  ]);
  assert.deepEqual(collectTags(fetchValue("[]"), undefined), []);
});

test("resetRequestCache is callable and does not touch stored entries", async () => {
  const handler = new PublicCacheHandler({ maxMemoryCacheSize: 1024 * 1024 });
  await handler.set("/entry/a", page("a"), {});
  handler.resetRequestCache();
  assert.ok(await handler.get("/entry/a", { kind: "APP_PAGE" }));
});

test("measureBytes counts strings, buffers, maps and nested objects", () => {
  assert.equal(measureBytes("abcd"), 8);
  assert.equal(measureBytes(Buffer.alloc(100)), 100);
  assert.ok(measureBytes(new Map([["segment", Buffer.alloc(50)]])) >= 50);
  assert.ok(measureBytes({ a: { b: "x".repeat(100) } }) >= 200);
});
