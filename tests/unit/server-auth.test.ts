import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { SignJWT } from "jose";
import "./next-runtime.ts";
import { setRequestScope } from "./stubs/next-headers.ts";

const AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const AUTH_PASSWORD = "test-password-0123456789";
process.env.PGHOST = "localhost";
process.env.PGUSER = "tasrif";
process.env.PGDATABASE = "tasrif";
process.env.AUTH_SECRET = AUTH_SECRET;
process.env.AUTH_PASSWORD = AUTH_PASSWORD;

const session = await import("~/server/auth/session");
const auth = await import("~/server/auth");
const guard = await import("~/server/auth/guard");
const { proxy, config } = await import("~/proxy");
const { NextRequest, NextResponse } = await import("next/server");

const signingKey = createHmac("sha256", AUTH_SECRET).update(AUTH_PASSWORD).digest();

const signWith = (
  claims: Record<string, unknown>,
  options: { key?: Uint8Array; jti?: string | null; expiresIn?: string | number } = {},
) => {
  let jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt();
  if (options.jti !== null) {
    jwt = jwt.setJti(options.jti ?? crypto.randomUUID());
  }
  return jwt.setExpirationTime(options.expiresIn ?? "1h").sign(options.key ?? signingKey);
};

const loginCookie = async () => ({ [session.SESSION_COOKIE_NAME]: await session.createSessionToken() });

test("a created session token verifies and carries a unique id and a 12 hour lifetime", async () => {
  const first = await session.createSessionToken();
  const second = await session.createSessionToken();
  const claims = await session.readSessionToken(first);
  assert.ok(claims);
  assert.notEqual(claims.id, (await session.readSessionToken(second))?.id);
  const lifetime = claims.expiresAtSeconds - Math.floor(Date.now() / 1000);
  assert.ok(lifetime > session.SESSION_MAX_AGE_SECONDS - 10 && lifetime <= session.SESSION_MAX_AGE_SECONDS);
  assert.equal(session.SESSION_MAX_AGE_SECONDS, 12 * 60 * 60);
  assert.equal(await session.verifySessionToken(first), true);
});

test("tokens that are tampered with, foreign, expired or malformed do not verify", async () => {
  const valid = await session.createSessionToken();
  const [header, payload, signature] = valid.split(".");
  assert.ok(header && payload && signature);
  const forgedPayload = Buffer.from(JSON.stringify({ role: "admin", jti: "x", exp: 9_999_999_999 })).toString(
    "base64url",
  );
  const candidates: Record<string, string> = {
    "flipped signature": `${header}.${payload}.${signature.slice(0, -2)}AA`,
    "swapped payload": `${header}.${forgedPayload}.${signature}`,
    "other key": await signWith(
      { role: "admin" },
      { key: new TextEncoder().encode("another-key-another-key-another-key") },
    ),
    "wrong role": await signWith({ role: "user" }),
    "no role": await signWith({}),
    "no jti": await signWith({ role: "admin" }, { jti: null }),
    expired: await signWith({ role: "admin" }, { expiresIn: Math.floor(Date.now() / 1000) - 60 }),
    unsigned: `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${forgedPayload}.`,
    garbage: "not-a-token",
    empty: "",
  };
  for (const [name, token] of Object.entries(candidates)) {
    assert.equal(await session.readSessionToken(token), null, name);
    assert.equal(await session.verifySessionToken(token), false, name);
  }
});

test("a revoked token stops verifying while other tokens keep working", async () => {
  const revoked = await session.createSessionToken();
  const other = await session.createSessionToken();
  await session.revokeSessionToken(revoked);
  assert.equal(await session.verifySessionToken(revoked), false);
  assert.equal(await session.verifySessionToken(other), true);
  await session.revokeSessionToken("garbage");
  assert.equal(await session.verifySessionToken(other), true);
});

test("the admin password check accepts only the exact password", () => {
  assert.equal(auth.isAdminPassword(AUTH_PASSWORD), true);
  for (const wrong of [
    "",
    "x",
    `${AUTH_PASSWORD} `,
    AUTH_PASSWORD.toUpperCase(),
    AUTH_PASSWORD.slice(0, -1),
    "a".repeat(5000),
  ]) {
    assert.equal(auth.isAdminPassword(wrong), false, wrong.slice(0, 20));
  }
});

test("the session cookie is httpOnly, strict, site-wide and expires with the session", async () => {
  const response = NextResponse.json({});
  await auth.setSessionCookie(response);
  const cookie = response.cookies.get(session.SESSION_COOKIE_NAME);
  assert.ok(cookie?.value);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, "strict");
  assert.equal(cookie.path, "/");
  assert.equal(cookie.maxAge, session.SESSION_MAX_AGE_SECONDS);
  assert.equal(await session.verifySessionToken(cookie.value), true);
});

test("clearing the cookie blanks it and expires it immediately", () => {
  const response = NextResponse.json({});
  auth.clearSessionCookie(response);
  const cookie = response.cookies.get(session.SESSION_COOKIE_NAME);
  assert.equal(cookie?.value, "");
  assert.equal(cookie?.maxAge, 0);
  assert.equal(cookie?.httpOnly, true);
  assert.equal(cookie?.sameSite, "strict");
});

test("a request is authenticated only with a valid unrevoked session cookie", async () => {
  setRequestScope({});
  assert.equal(await auth.isAuthenticated(), false);
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: "garbage" } });
  assert.equal(await auth.isAuthenticated(), false);

  const cookies = await loginCookie();
  setRequestScope({ cookies });
  assert.equal(await auth.isAuthenticated(), true);
  await auth.revokeCurrentSession();
  assert.equal(await auth.isAuthenticated(), false);
  setRequestScope({});
  await auth.revokeCurrentSession();
});

const digestOf = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    return (error as { digest?: string }).digest ?? String(error);
  }
  return null;
};

test("the api guard answers 401 with a json body unless the session is valid", async () => {
  setRequestScope({});
  const denied = await guard.requireAdminApi();
  assert.equal(denied?.status, 401);
  assert.deepEqual(await denied?.json(), { error: "Unauthorized" });

  setRequestScope({ cookies: await loginCookie() });
  assert.equal(await guard.requireAdminApi(), null);
});

test("the action guard throws Unauthorized unless the session is valid", async () => {
  setRequestScope({});
  await assert.rejects(guard.requireAdminAction(), /Unauthorized/);
  setRequestScope({ cookies: await loginCookie() });
  await assert.doesNotReject(guard.requireAdminAction());
});

test("the page guard redirects to the login page with a safe next path", async () => {
  setRequestScope({ headers: { "x-admin-path": "/admin/entries?page=2" } });
  assert.equal(
    await digestOf(() => guard.requireAdmin()),
    "NEXT_REDIRECT;replace;/auth/login?next=%2Fadmin%2Fentries%3Fpage%3D2;307;",
  );
  assert.equal(
    await digestOf(() => guard.requireAdmin("/admin/new-entry")),
    "NEXT_REDIRECT;replace;/auth/login?next=%2Fadmin%2Fnew-entry;307;",
  );
  setRequestScope({ headers: { "x-admin-path": "//evil.example" } });
  assert.equal(await digestOf(() => guard.requireAdmin()), "NEXT_REDIRECT;replace;/auth/login;307;");

  setRequestScope({ cookies: await loginCookie() });
  assert.equal(await digestOf(() => guard.requireAdmin()), null);
});

const adminRequest = (url: string, init: { method?: string; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers: init.cookie ? { cookie: init.cookie } : {},
  });

test("the proxy redirects an anonymous page request to the login page and keeps the query", async () => {
  const response = await proxy(adminRequest("/admin/entries?page=2&filter=Unverified"));
  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get("location") ?? "").pathname + new URL(response.headers.get("location") ?? "").search,
    "/auth/login?next=%2Fadmin%2Fentries%3Fpage%3D2%26filter%3DUnverified",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("the proxy drops the router payload marker from the next path", async () => {
  const response = await proxy(adminRequest("/admin/entries?_rsc=abc123"));
  assert.equal(new URL(response.headers.get("location") ?? "").search, "?next=%2Fadmin%2Fentries");
});

test("the proxy refuses an anonymous write with a json 401 instead of a redirect", async () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const response = await proxy(adminRequest("/admin/entries", { method }));
    assert.equal(response.status, 401, method);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
    assert.equal(response.headers.get("location"), null);
  }
  assert.equal((await proxy(adminRequest("/admin/entries", { method: "HEAD" }))).status, 307);
});

test("the proxy rejects forged and revoked cookies", async () => {
  const forged = await signWith(
    { role: "admin" },
    { key: new TextEncoder().encode("a-different-signing-key-a-different") },
  );
  const forgedResponse = await proxy(adminRequest("/admin", { cookie: `${session.SESSION_COOKIE_NAME}=${forged}` }));
  assert.equal(forgedResponse.status, 307);

  const token = await session.createSessionToken();
  await session.revokeSessionToken(token);
  const revokedResponse = await proxy(adminRequest("/admin", { cookie: `${session.SESSION_COOKIE_NAME}=${token}` }));
  assert.equal(revokedResponse.status, 307);
});

test("the proxy lets a valid session through and passes the current path on", async () => {
  const token = await session.createSessionToken();
  const response = await proxy(
    adminRequest("/admin/edit-entry/4?x=1&_rsc=zz", { cookie: `${session.SESSION_COOKIE_NAME}=${token}` }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-request-x-admin-path"), "/admin/edit-entry/4?x=1");
});

test("the proxy answers 400 for path bytes that are not valid UTF-8 or percent-encoding", async () => {
  for (const path of ["/entry/%FF", "/entry/%C3%28", "/lang/%E0%A4%A", "/root/%zz", "/admin/%FF", "/entry/x%"]) {
    const response = await proxy(adminRequest(path));
    assert.equal(response.status, 400, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
  }
});

test("the proxy lets well-formed public paths through untouched and without needing a session", async () => {
  const encoded = encodeURIComponent("كتب");
  for (const path of [
    `/entry/${encoded}`,
    "/entry/book",
    "/lang/ar?page=2",
    "/arabic-verb-form/1",
    "/appendix/arabic-verbs",
  ]) {
    const response = await proxy(adminRequest(path));
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("location"), null, path);
    assert.equal(response.headers.get("x-middleware-request-x-admin-path"), null, path);
  }
});

test("the proxy only runs for the admin area and the public dynamic routes", () => {
  assert.deepEqual(config.matcher, [
    "/admin/:path*",
    "/entry/:path*",
    "/root/:path*",
    "/lang/:path*",
    "/arabic-verb-form/:path*",
    "/appendix/:path*",
  ]);
});
