import assert from "node:assert/strict";
import { test } from "node:test";
import "./next-runtime.ts";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";
import { setRequestScope } from "./stubs/next-headers.ts";

const { sql } = await openRepository();

const session = await import("~/server/auth/session");
const login = await import("~/app/api/auth/login/route");
const logout = await import("~/app/api/auth/logout/route");
const status = await import("~/app/api/auth/status/route");
const health = await import("~/app/api/health/route");
const entrySearch = await import("~/app/api/entries/search/route");
const senseSearch = await import("~/app/api/senses/search/route");
const verbForm = await import("~/app/api/verb-form/resolve/route");
const { ENTRY_SEARCH_DEFAULT_LIMIT, ENTRY_SEARCH_MAX_LIMIT } = await import("~/lib/api/entry-search");
const { SENSE_SEARCH_MAX_LIMIT, SENSE_SEARCH_DEFAULT_LIMIT } = await import("~/lib/api/sense-search");

const PASSWORD = "test-password-0123456789";
const ORIGIN = "http://localhost:3000";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const get = (path: string) => new Request(`${ORIGIN}${path}`);

const asAdmin = async () =>
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: await session.createSessionToken() } });
const asAnonymous = () => setRequestScope({});

const kitab = await insertEntryWithSense(sql, { language: "ar", text: "كِتَاب", root: "كتب" });
await insertEntryWithSense(sql, { language: "ar", text: "كَتَبَ", root: "كتب", pos: "verb" });
await insertEntryWithSense(sql, { language: "ar", text: "مسودة", root: "سود", isVerified: false });
await insertEntryWithSense(sql, { language: "en", text: "book" });
for (let index = 0; index < 55; index++) {
  await insertEntryWithSense(sql, { language: "en", text: `bulk entry ${String(index).padStart(2, "0")}` });
}
await sql.exec(
  `UPDATE lexical_entry
   SET search_vector = CASE
     WHEN language = 'ar' THEN to_tsvector('arabic', text || ' ' || normalized_text)
     ELSE to_tsvector('english', text || ' ' || normalized_text)
   END`,
);

let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;

test("login rejects a body that is not json, not an object or has no password", async () => {
  const ip = freshIp();
  for (const body of ["not json", "null", "[]", "{}", '{"password":""}', '{"password":42}', '"text"']) {
    const response = await login.POST(post("/api/auth/login", body, { "x-real-ip": ip }));
    assert.equal(response.status, 400, body);
    assert.deepEqual(await response.json(), { error: "Missing password" }, body);
    assert.equal(response.headers.get("set-cookie"), null, body);
  }
});

test("login with the wrong password answers 401 without a cookie", async () => {
  const response = await login.POST(
    post("/api/auth/login", { password: "wrong-password-xx" }, { "x-real-ip": freshIp() }),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid password" });
  assert.equal(response.headers.get("set-cookie"), null);
});

test("login with the right password sets a strict httpOnly session cookie that verifies", async () => {
  const response = await login.POST(post("/api/auth/login", { password: PASSWORD }, { "x-real-ip": freshIp() }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^admin_session=[\w-]+\.[\w-]+\.[\w-]+;/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=43200/);
  const token = cookie.split(";")[0]?.split("=")[1] ?? "";
  assert.equal(await session.verifySessionToken(token), true);
});

test("five wrong passwords lock the address out, with Retry-After, even for the right password", async () => {
  const ip = freshIp();
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await login.POST(
      post("/api/auth/login", { password: `wrong-attempt-${attempt}` }, { "x-real-ip": ip }),
    );
    assert.equal(response.status, 401, `attempt ${attempt}`);
  }
  const locked = await login.POST(post("/api/auth/login", { password: PASSWORD }, { "x-real-ip": ip }));
  assert.equal(locked.status, 429);
  assert.deepEqual(await locked.json(), { error: "Too many login attempts. Please try again later." });
  assert.equal(locked.headers.get("retry-after"), String(15 * 60));
  assert.equal(locked.headers.get("set-cookie"), null);

  const other = await login.POST(post("/api/auth/login", { password: PASSWORD }, { "x-real-ip": freshIp() }));
  assert.equal(other.status, 200);
});

test("rotating a forged leading x-forwarded-for entry does not escape the limit", async () => {
  const realClient = freshIp();
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await login.POST(
      post(
        "/api/auth/login",
        { password: `guess-${attempt}` },
        { "x-forwarded-for": `10.0.0.${attempt}, ${realClient}` },
      ),
    );
    assert.equal(response.status, 401);
  }
  const forged = await login.POST(
    post("/api/auth/login", { password: PASSWORD }, { "x-forwarded-for": `10.9.9.9, ${realClient}` }),
  );
  assert.equal(forged.status, 429);
});

test("a successful login forgives earlier failures from the same address", async () => {
  const ip = freshIp();
  for (let attempt = 0; attempt < 4; attempt++) {
    await login.POST(post("/api/auth/login", { password: `nope-${attempt}` }, { "x-real-ip": ip }));
  }
  assert.equal((await login.POST(post("/api/auth/login", { password: PASSWORD }, { "x-real-ip": ip }))).status, 200);
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal(
      (await login.POST(post("/api/auth/login", { password: `again-${attempt}` }, { "x-real-ip": ip }))).status,
      401,
    );
  }
});

test("logout redirects to the login page, expires the cookie and revokes the session", async () => {
  const token = await session.createSessionToken();
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: token } });
  const response = await logout.POST();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/auth/login");
  assert.match(response.headers.get("set-cookie") ?? "", /admin_session=;.*Max-Age=0/);
  assert.equal(await session.verifySessionToken(token), false);

  asAnonymous();
  assert.equal((await logout.POST()).status, 303);
});

test("the status route reports whether the caller is an admin and nothing else", async () => {
  asAnonymous();
  assert.deepEqual(await (await status.GET()).json(), { isAdmin: false });
  await asAdmin();
  assert.deepEqual(await (await status.GET()).json(), { isAdmin: true });
});

test("the health route is uncached and reports ok", async () => {
  const response = health.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

const entryItems = async (query: string) => {
  const response = await entrySearch.GET(get(`/api/entries/search${query}`));
  return {
    status: response.status,
    body: (await response.json()) as { items?: Record<string, unknown>[]; error?: string },
  };
};

test("the entry search is public, returns only the documented fields and skips unverified entries", async () => {
  asAnonymous();
  const { status: code, body } = await entryItems("?query=كت");
  assert.equal(code, 200);
  assert.equal(body.items?.length, 2);
  for (const item of body.items ?? []) {
    assert.deepEqual(Object.keys(item).sort(), ["id", "language", "normalizedText", "root", "slug", "text"]);
  }
  assert.equal((await entryItems("?query=م")).body.items?.length, 0);
  const first = body.items?.find((item) => item.id === kitab.entryId);
  assert.deepEqual(first, {
    id: kitab.entryId,
    text: "كِتَاب",
    slug: "كتاب",
    normalizedText: "كتاب",
    language: "ar",
    root: "كتب",
  });
});

test("the entry search answers an empty list for a missing or blank query", async () => {
  for (const query of ["", "?query=", "?query=%20%20", "?limit=5"]) {
    const { status: code, body } = await entryItems(query);
    assert.equal(code, 200, query);
    assert.deepEqual(body, { items: [] }, query);
  }
});

test("the entry search bounds the query length and the limit", async () => {
  const tooLong = await entryItems(`?query=${"a".repeat(101)}`);
  assert.equal(tooLong.status, 400);
  assert.deepEqual(tooLong.body, { error: "Invalid parameters" });
  assert.equal((await entryItems(`?query=${"a".repeat(100)}`)).status, 200);

  assert.equal((await entryItems("?query=b")).body.items?.length, ENTRY_SEARCH_DEFAULT_LIMIT);
  assert.equal((await entryItems("?query=b&limit=3")).body.items?.length, 3);
  for (const bad of ["0", "-1", "abc", "1.5", String(ENTRY_SEARCH_MAX_LIMIT + 1)]) {
    assert.equal((await entryItems(`?query=b&limit=${bad}`)).body.items?.length, ENTRY_SEARCH_DEFAULT_LIMIT, bad);
  }
  assert.equal(
    (await entryItems(`?query=b&limit=${ENTRY_SEARCH_MAX_LIMIT}`)).body.items?.length,
    ENTRY_SEARCH_MAX_LIMIT,
  );
});

const senseResponse = async (query: string) => {
  const response = await senseSearch.GET(get(`/api/senses/search${query}`));
  return {
    status: response.status,
    body: (await response.json()) as { items?: Record<string, unknown>[]; hasMore?: boolean; error?: string },
  };
};

test("the sense search requires an admin session in both of its modes", async () => {
  asAnonymous();
  for (const query of ["?query=book", "?ids=1,2"]) {
    const { status: code, body } = await senseResponse(query);
    assert.equal(code, 401, query);
    assert.deepEqual(body, { error: "Unauthorized" }, query);
  }
});

test("the sense search by ids returns the requested senses and ignores junk and duplicates", async () => {
  await asAdmin();
  const { status: code, body } = await senseResponse(`?ids=${kitab.senseId},${kitab.senseId}, abc,-4,0,1.5,,99999999`);
  assert.equal(code, 200);
  assert.equal(body.hasMore, false);
  assert.deepEqual(body.items, [{ id: kitab.senseId, text: "كِتَاب", pos: "noun", language: "ar" }]);
  assert.deepEqual((await senseResponse("?ids=")).body, { items: [], hasMore: false });
});

test("the sense search by ids reads at most the maximum number of ids", async () => {
  await asAdmin();
  const total = await sql.scalar<number>("SELECT count(*)::int FROM sense");
  assert.ok(total > SENSE_SEARCH_MAX_LIMIT);
  const ids = Array.from({ length: total }, (_, index) => index + 1).join(",");
  const { body } = await senseResponse(`?ids=${ids}`);
  assert.ok((body.items?.length ?? 0) <= SENSE_SEARCH_MAX_LIMIT);
});

test("the sense search by text needs two characters, honours language, paging and rejects bad parameters", async () => {
  await asAdmin();
  assert.deepEqual((await senseResponse("?query=b")).body, { items: [], hasMore: false });
  assert.deepEqual((await senseResponse("")).body, { items: [], hasMore: false });

  const arabic = await senseResponse(`?query=${encodeURIComponent("كتاب")}&language=ar`);
  assert.equal(arabic.status, 200);
  assert.ok(arabic.body.items?.some((item) => item.id === kitab.senseId));
  assert.ok(arabic.body.items?.every((item) => item.language === "ar"));
  assert.equal((await senseResponse(`?query=${encodeURIComponent("كتاب")}&language=en`)).body.items?.length, 0);

  assert.equal((await senseResponse("?query=book&language=fr")).status, 400);

  const paged = await senseResponse("?query=bulk&language=en&limit=10");
  assert.equal(paged.body.items?.length, 10);
  assert.equal(paged.body.hasMore, true);
  const lastPage = await senseResponse("?query=bulk&language=en&limit=10&page=6");
  assert.equal(lastPage.body.items?.length, 5);
  assert.equal(lastPage.body.hasMore, false);
  const fallback = await senseResponse("?query=bulk&language=en&limit=500&page=zero");
  assert.equal(fallback.body.items?.length, SENSE_SEARCH_DEFAULT_LIMIT);
});

const verbResponse = async (query: string) => {
  const response = await verbForm.GET(get(`/api/verb-form/resolve${query}`));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

test("the verb form resolver requires an admin session and a root", async () => {
  asAnonymous();
  assert.deepEqual(await verbResponse("?root=كتب"), { status: 401, body: { error: "Unauthorized" } });
  await asAdmin();
  for (const query of ["", "?root=", "?root=%20", "?root=كتب&formChoice=form-11", "?root=كتب&formChoice=Form-1"]) {
    assert.deepEqual(await verbResponse(query), { status: 400, body: { error: "Invalid parameters" } }, query);
  }
});

test("the verb form resolver classifies a valid root and resolves the chosen form to a pattern", async () => {
  await asAdmin();
  const classified = await verbResponse(`?root=${encodeURIComponent("كتب")}`);
  assert.equal(classified.status, 200);
  assert.ok(Array.isArray(classified.body.classification));
  assert.equal(classified.body.rootError, null);
  assert.equal(classified.body.pattern, null);

  const resolved = await verbResponse(`?root=${encodeURIComponent("كتب")}&formChoice=form-1-a-u`);
  assert.equal(resolved.status, 200);
  const pattern = resolved.body.pattern as { id: number; description: string };
  assert.equal(typeof pattern.id, "number");
  assert.equal(pattern.description, "a ~ u");
});

test("the verb form resolver reports an invalid root as a message, not an error status", async () => {
  await asAdmin();
  for (const root of ["ترجم", "ab", "ك"]) {
    const { status: code, body } = await verbResponse(`?root=${encodeURIComponent(root)}&formChoice=form-1-a-u`);
    assert.equal(code, 200, root);
    assert.equal(body.classification, null, root);
    assert.equal(body.pattern, null, root);
    assert.equal(typeof body.rootError, "string", root);
  }
});

test("a null character in any query parameter is a 400, not a database error", async () => {
  await asAdmin();
  const nul = "%00";
  assert.deepEqual(await entryItems(`?query=${nul}ab`), { status: 400, body: { error: "Invalid parameters" } });
  assert.deepEqual(await entryItems(`?query=ab${nul}`), { status: 400, body: { error: "Invalid parameters" } });
  assert.deepEqual(await senseResponse(`?query=book${nul}`), { status: 400, body: { error: "Invalid parameters" } });
  assert.deepEqual(await verbResponse(`?root=${nul}كتب`), { status: 400, body: { error: "Invalid parameters" } });
});

test("the admin search endpoints bound the length of free text like the public one", async () => {
  await asAdmin();
  assert.deepEqual(await senseResponse(`?query=${"a".repeat(101)}`), {
    status: 400,
    body: { error: "Invalid parameters" },
  });
  assert.equal((await senseResponse(`?query=${"a".repeat(100)}`)).status, 200);
  assert.deepEqual(await verbResponse(`?root=${"ك".repeat(101)}`), {
    status: 400,
    body: { error: "Invalid parameters" },
  });
  assert.equal((await verbResponse(`?root=${"ك".repeat(100)}`)).status, 200);
});
