import assert from "node:assert/strict";
import { test } from "node:test";
import { findTags, renderMarkup } from "./public-render.ts";
import { openRepository } from "./repository-db.ts";

const { sql } = await openRepository();

const { default: EntryPage, generateMetadata } = await import("~/app/entry/[slug]/page");
const { getRedirectStatusCodeFromError, getURLFromRedirectError } = await import(
  "next/dist/client/components/redirect.js"
);
const { isRedirectError } = await import("next/dist/client/components/redirect-error.js");

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

const addEntry = async (text: string, options: { language?: "ar" | "en"; verified?: boolean } = {}) => {
  const id = await sql.scalar<number>(
    "INSERT INTO lexical_entry (language, text, is_verified) VALUES ($1, $2, $3) RETURNING id",
    [options.language ?? "en", text, options.verified ?? true],
  );
  await sql.exec(
    "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, 'noun', 1, ARRAY[$2])",
    [id, `definition of ${text}`],
  );
  return id;
};

const outcome = async (key: string) => {
  try {
    const page = await EntryPage(params(key));
    return { kind: "page" as const, html: renderMarkup(page) };
  } catch (error) {
    if (isNotFound(error)) {
      return { kind: "missing" as const };
    }
    if (!isRedirectError(error)) {
      throw error;
    }
    const status = getRedirectStatusCodeFromError(error);
    return { kind: "redirect" as const, status, location: getURLFromRedirectError(error) };
  }
};

const toWrite = await addEntry("to write");
const aLot = await addEntry("a lot");
const alot = await addEntry("alot");
const kataba = await addEntry("كَتَبَ", { language: "ar" });
await addEntry("hidden phrase", { verified: false });

test("a live slug renders the entry", async () => {
  const result = await outcome("to-write");
  assert.equal(result.kind, "page");
  assert.ok(
    result.kind === "page" && findTags(result.html, "div").some((tag) => tag.attributes.id === `entry-${toWrite}`),
  );
});

test("the old normalized_text URL answers a permanent redirect to the slug URL", async () => {
  assert.deepEqual(await outcome("towrite"), { kind: "redirect", status: 308, location: "/entry/to-write" });
});

test("a slug wins over the old key of another entry", async () => {
  const result = await outcome("alot");
  assert.equal(result.kind, "page");
  assert.ok(
    result.kind === "page" && findTags(result.html, "div").some((tag) => tag.attributes.id === `entry-${alot}`),
  );
  assert.ok(
    result.kind === "page" && !findTags(result.html, "div").some((tag) => tag.attributes.id === `entry-${aLot}`),
  );
  assert.equal((await outcome("a-lot")).kind, "page");
});

test("an arabic slug can be requested percent-encoded and an unnormalised spelling is redirected to it", async () => {
  const encoded = await outcome(encodeURIComponent("كتب"));
  assert.equal(encoded.kind, "page");
  assert.ok(
    encoded.kind === "page" && findTags(encoded.html, "div").some((tag) => tag.attributes.id === `entry-${kataba}`),
  );

  assert.deepEqual(await outcome("كَتَبَ"), {
    kind: "redirect",
    status: 308,
    location: `/entry/${encodeURIComponent("كتب")}`,
  });
  assert.deepEqual(await outcome("To-Write"), { kind: "redirect", status: 308, location: "/entry/to-write" });
});

test("a renamed entry keeps answering at its old slug and at its old key", async () => {
  const id = await addEntry("short lived name");
  await sql.exec("UPDATE lexical_entry SET text = 'long lived name' WHERE id = $1", [id]);
  assert.deepEqual(await outcome("short-lived-name"), {
    kind: "redirect",
    status: 308,
    location: "/entry/long-lived-name",
  });
  assert.deepEqual(await outcome("shortlivedname"), {
    kind: "redirect",
    status: 308,
    location: "/entry/long-lived-name",
  });
  assert.equal((await outcome("long-lived-name")).kind, "page");

  await sql.exec("UPDATE lexical_entry SET text = 'third name' WHERE id = $1", [id]);
  assert.deepEqual(await outcome("short-lived-name"), { kind: "redirect", status: 308, location: "/entry/third-name" });
  assert.deepEqual(await outcome("long-lived-name"), { kind: "redirect", status: 308, location: "/entry/third-name" });
});

test("an old key shared by entries with different slugs goes to the entry with the lowest id", async () => {
  const first = await addEntry("ab cd");
  const second = await addEntry("a bcd");
  assert.ok(first < second);
  assert.deepEqual(await outcome("abcd"), { kind: "redirect", status: 308, location: "/entry/ab-cd" });
});

test("unknown keys, unverified entries and keys of nothing are not found", async () => {
  for (const key of ["never-existed", "hidden-phrase", "hiddenphrase", "---", "%"]) {
    assert.deepEqual(await outcome(key), { kind: "missing" }, key);
  }
});

test("the metadata of a live entry has the slug canonical and a redirect or a miss has none", async () => {
  const live = await generateMetadata(params("to-write"));
  assert.deepEqual(live.alternates, { canonical: "/entry/to-write" });
  assert.deepEqual(await generateMetadata(params("towrite")), {});
  assert.deepEqual(await generateMetadata(params("never-existed")), {});
});
