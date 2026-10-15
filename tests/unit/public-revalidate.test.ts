import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external.js";
import "./public-render.ts";

const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external.js");
const { revalidatePublicPages } = await import("~/server/actions/shared");
const { PUBLIC_DATA_TAG } = await import("~/server/cache/tags");

interface PendingTag {
  tag: string;
  profile?: { expire?: number };
}

interface FakeStore {
  incrementalCache: object;
  route: string;
  page: string;
  pendingRevalidatedTags?: PendingTag[];
}

const runAction = (): FakeStore => {
  const store: FakeStore = { incrementalCache: {}, route: "/admin/new-entry", page: "/admin/new-entry" };
  workAsyncStorage.run(store as unknown as WorkStore, () => revalidatePublicPages());
  return store;
};

test("revalidatePublicPages expires the whole site layout tag and the public data tag", () => {
  const store = runAction();
  const tags = (store.pendingRevalidatedTags ?? []).map((pending) => pending.tag).sort();
  assert.deepEqual(tags, ["_N_T_/layout", PUBLIC_DATA_TAG].sort());
});

test("the public data tag is expired immediately rather than served stale", () => {
  const pending = runAction().pendingRevalidatedTags ?? [];
  const publicData = pending.find((item) => item.tag === PUBLIC_DATA_TAG);
  assert.equal(publicData?.profile?.expire, 0);
  const layout = pending.find((item) => item.tag === "_N_T_/layout");
  assert.equal(layout?.profile, undefined);
});

test("the tag shared by the cached queries and the invalidation is the same constant", () => {
  assert.equal(PUBLIC_DATA_TAG, "public-data");
});
