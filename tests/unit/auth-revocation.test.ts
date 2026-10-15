import assert from "node:assert/strict";
import { test } from "node:test";
import { createRevocationList } from "~/server/auth/revocation";

test("a revoked id is reported as revoked and others are not", () => {
  const list = createRevocationList(() => 1_000_000);
  list.revoke("a", 1_000 + 3600);
  assert.equal(list.isRevoked("a"), true);
  assert.equal(list.isRevoked("b"), false);
});

test("expired entries are pruned on the next revocation", () => {
  let nowMs = 1_000_000;
  const list = createRevocationList(() => nowMs);
  list.revoke("short", 1_000 + 60);
  list.revoke("long", 1_000 + 3600);
  assert.equal(list.size(), 2);

  nowMs += 120_000;
  list.revoke("third", 1_000 + 7200);
  assert.equal(list.isRevoked("short"), false);
  assert.equal(list.isRevoked("long"), true);
  assert.equal(list.size(), 2);
});
