import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLoginRedirect } from "~/components/auth/redirectTarget";
import { getSafeNextPath } from "~/lib/safe-next-path";

const ORIGIN = "https://tasrif.example";

test("getSafeNextPath keeps same-origin absolute paths unchanged", () => {
  for (const path of [
    "/",
    "/admin",
    "/admin/entries?page=2&filter=Unverified",
    "/entry/%D9%83%D8%AA%D8%A8#sense-3",
    "/a/../b",
    "/%2f/evil.example",
  ]) {
    assert.equal(getSafeNextPath(path), path, path);
  }
});

test("getSafeNextPath rejects values that could leave the site", () => {
  for (const value of [
    "//evil.example",
    "///evil.example",
    "//evil.example/admin",
    "/\\evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "https://evil.example/admin",
    "http://evil.example",
    "javascript:alert(1)",
    "data:text/html,x",
    "admin/entries",
    "",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\u0000",
    "/\u007f",
    "/ok\u001fno",
  ]) {
    assert.equal(getSafeNextPath(value), null, JSON.stringify(value));
  }
});

test("getSafeNextPath rejects a missing value", () => {
  assert.equal(getSafeNextPath(undefined), null);
  assert.equal(getSafeNextPath(null), null);
});

test("resolveLoginRedirect prefers a safe next path", () => {
  assert.equal(resolveLoginRedirect("/admin/entries?page=2", "", ORIGIN), "/admin/entries?page=2");
  assert.equal(resolveLoginRedirect("/lang/ar", `${ORIGIN}/admin/entries`, ORIGIN), "/lang/ar");
});

test("resolveLoginRedirect ignores an unsafe next path and falls back to the referrer or the home page", () => {
  assert.equal(resolveLoginRedirect("//evil.example", `${ORIGIN}/admin/entries`, ORIGIN), "/admin");
  assert.equal(resolveLoginRedirect("https://evil.example", `${ORIGIN}/admin`, ORIGIN), "/admin");
  assert.equal(resolveLoginRedirect("//evil.example", `${ORIGIN}/entry/book`, ORIGIN), "/");
  assert.equal(resolveLoginRedirect(null, "", ORIGIN), "/");
});

test("resolveLoginRedirect only trusts an admin referrer from the same origin", () => {
  assert.equal(resolveLoginRedirect(null, `${ORIGIN}/admin`, ORIGIN), "/admin");
  assert.equal(resolveLoginRedirect(null, `${ORIGIN}/admin/morph-patterns/3`, ORIGIN), "/admin");
  assert.equal(resolveLoginRedirect(null, "https://evil.example/admin", ORIGIN), "/");
  assert.equal(resolveLoginRedirect(null, `${ORIGIN}/administrator`, ORIGIN), "/");
  assert.equal(resolveLoginRedirect(null, "not a url", ORIGIN), "/");
});
