import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLoginPath } from "~/server/auth/login-path";

test("buildLoginPath encodes a relative admin path into the next parameter", () => {
  assert.equal(buildLoginPath("/admin/entries"), "/auth/login?next=%2Fadmin%2Fentries");
  assert.equal(
    buildLoginPath("/admin/entries?page=2&filter=Unverified"),
    "/auth/login?next=%2Fadmin%2Fentries%3Fpage%3D2%26filter%3DUnverified",
  );
});

test("buildLoginPath round-trips through URLSearchParams", () => {
  const target = "/admin/entries?page=2&filter=Unverified";
  const params = new URL(buildLoginPath(target), "http://localhost").searchParams;
  assert.equal(params.get("next"), target);
});

test("buildLoginPath omits next when it is missing or unsafe", () => {
  assert.equal(buildLoginPath(), "/auth/login");
  assert.equal(buildLoginPath(null), "/auth/login");
  assert.equal(buildLoginPath(""), "/auth/login");
  assert.equal(buildLoginPath("https://evil.example/admin"), "/auth/login");
  assert.equal(buildLoginPath("//evil.example/admin"), "/auth/login");
  assert.equal(buildLoginPath("/\\evil.example"), "/auth/login");
  assert.equal(buildLoginPath("admin/entries"), "/auth/login");
});

test("buildLoginPath applies the same checks as the login redirect", () => {
  for (const unsafe of [
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\u0000",
    "/\u007f",
    "/ok\u001fno",
  ]) {
    assert.equal(buildLoginPath(unsafe), "/auth/login", JSON.stringify(unsafe));
  }
  assert.equal(buildLoginPath("/"), "/auth/login?next=%2F");
  assert.equal(buildLoginPath("javascript:alert(1)"), "/auth/login");
});
