import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import "./next-runtime.ts";

const { decodeSlugOrNotFound, parseIdOrNotFound } = await import("~/lib/validation/params");
const verbForms = await import("~/lib/validation/verbFormChoice");
const { validateFormOneVowels } = await import("~/lib/validation/formOneVowels");
const { resolveLoginRedirect } = await import("~/components/auth/redirectTarget");
const { getSafeNextPath } = await import("~/lib/safe-next-path");
const { isNonEmptyString } = await import("~/lib/validation");
const { lookupSense, rememberSense } = await import("~/hooks/senseLookup");
const { SENSE_SEARCH_MAX_LIMIT } = await import("~/lib/api/sense-search");
const { z } = await import("zod");

const { containsNul } = await import("~/lib/validation/nul");

const notFoundDigest = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    return (error as { digest?: string }).digest ?? String(error);
  }
  return null;
};

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

test("an id route parameter must be a plain positive integer", async () => {
  assert.equal(await parseIdOrNotFound(Promise.resolve({ id: "42" })), 42);
  assert.equal(await parseIdOrNotFound(Promise.resolve({ overrideId: "7" }), "overrideId"), 7);
  for (const bad of ["0", "-1", "01", "1.5", "1e3", " 4", "4 ", "", "abc", "٣", "9007199254740993", "1;DROP"]) {
    assert.equal(await notFoundDigest(() => parseIdOrNotFound(Promise.resolve({ id: bad }))), NOT_FOUND, bad);
  }
});

test("a slug is decoded when percent-encoded and an invalid encoding is a 404", async () => {
  assert.equal(await decodeSlugOrNotFound(Promise.resolve({ slug: "book" })), "book");
  assert.equal(await decodeSlugOrNotFound(Promise.resolve({ slug: encodeURIComponent("كتاب") })), "كتاب");
  assert.equal(await decodeSlugOrNotFound(Promise.resolve({ slug: "a%20b" })), "a b");
  assert.equal(await notFoundDigest(() => decodeSlugOrNotFound(Promise.resolve({ slug: "%E0%A4%A" }))), NOT_FOUND);
  assert.equal(await notFoundDigest(() => decodeSlugOrNotFound(Promise.resolve({ slug: "%00" }))), NOT_FOUND);
  assert.equal(await notFoundDigest(() => decodeSlugOrNotFound(Promise.resolve({ slug: "a%00b" }))), NOT_FOUND);
  assert.equal(await notFoundDigest(() => decodeSlugOrNotFound(Promise.resolve({ slug: "a\u0000b" }))), NOT_FOUND);
});

test("every verb form choice resolves to a distinct form and vowel combination and back", () => {
  const seen = new Set<string>();
  for (const choice of verbForms.verbFormChoices) {
    const resolved = verbForms.resolveVerbFormChoice(choice);
    assert.equal(verbForms.findVerbFormChoice(resolved), choice);
    const key = `${resolved.formNumber}:${resolved.perfectVowel}:${resolved.imperfectVowel}`;
    assert.equal(seen.has(key), false, key);
    seen.add(key);
    assert.equal(resolved.perfectVowel === null, resolved.formNumber !== 1);
  }
  assert.equal(seen.size, 15);
  assert.equal(verbForms.findVerbFormChoice({ formNumber: 1, perfectVowel: "u", imperfectVowel: "a" }), undefined);
  assert.equal(verbForms.findVerbFormChoice({ formNumber: 2, perfectVowel: "a", imperfectVowel: "u" }), undefined);
});

test("the quadriliteral verb form choices resolve to four radicals and back, apart from the triliteral ones", () => {
  assert.deepEqual([...verbForms.quadriliteralVerbFormChoices], ["form-1q", "form-2q", "form-3q", "form-4q"]);
  assert.deepEqual(verbForms.allVerbFormChoices, [
    ...verbForms.verbFormChoices,
    ...verbForms.quadriliteralVerbFormChoices,
  ]);
  const seen = new Set<string>();
  for (const choice of verbForms.quadriliteralVerbFormChoices) {
    const resolved = verbForms.resolveVerbFormChoice(choice);
    assert.equal(resolved.radicalCount, 4, choice);
    assert.equal(verbForms.findVerbFormChoice(resolved), choice);
    assert.equal(verbForms.verbFormChoiceRadicalCount(choice), 4);
    const key = `${resolved.formNumber}:${resolved.perfectVowel}:${resolved.imperfectVowel}`;
    assert.equal(seen.has(key), false, key);
    seen.add(key);
  }
  assert.deepEqual(verbForms.resolveVerbFormChoice("form-1q"), {
    formNumber: 1,
    radicalCount: 4,
    perfectVowel: "a",
    imperfectVowel: "i",
  });
  assert.equal(verbForms.findVerbFormChoice({ formNumber: 1, perfectVowel: "a", imperfectVowel: "i" }), "form-1-a-i");
  assert.equal(
    verbForms.findVerbFormChoice({ formNumber: 1, radicalCount: 4, perfectVowel: "a", imperfectVowel: "i" }),
    "form-1q",
  );
  assert.equal(
    verbForms.findVerbFormChoice({ formNumber: 2, radicalCount: 4, perfectVowel: null, imperfectVowel: null }),
    "form-2q",
  );
  assert.equal(
    verbForms.findVerbFormChoice({ formNumber: 5, radicalCount: 4, perfectVowel: null, imperfectVowel: null }),
    undefined,
  );
  assert.equal(verbForms.verbFormChoiceSchema.safeParse("form-3q").success, true);
  assert.equal(verbForms.verbFormChoiceSchema.safeParse("form-5q").success, false);
});

test("quadriliteral labels carry the q suffix and no vowel pair", () => {
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-1q"), "Form Iq");
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-2q"), "Form IIq");
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-3q"), "Form IIIq");
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-4q"), "Form IVq");
});

test("verb form labels name the form and, for form I, the vowel pair", () => {
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-1-a-u"), "Form I (a ~ u)");
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-1-i-a"), "Form I (i ~ a)");
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-8"), "Form VIII");
  assert.equal(verbForms.formatVerbFormChoiceLabel("form-10"), "Form X");
  assert.equal(verbForms.verbFormChoiceSchema.safeParse("form-11").success, false);
  assert.equal(verbForms.verbFormChoiceSchema.safeParse("Form-1-a-u").success, false);
});

const vowelIssues = (data: {
  formNumber: number;
  perfectVowel: "a" | "i" | "u" | null;
  imperfectVowel: "a" | "i" | "u" | null;
}) => {
  const schema = z
    .object({})
    .passthrough()
    .superRefine((_value, ctx) => validateFormOneVowels(data, ctx));
  const result = schema.safeParse({});
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

test("form I needs both vowels and the other forms need neither", () => {
  assert.deepEqual(vowelIssues({ formNumber: 1, perfectVowel: "a", imperfectVowel: "u" }), []);
  assert.deepEqual(vowelIssues({ formNumber: 2, perfectVowel: null, imperfectVowel: null }), []);
  assert.deepEqual(vowelIssues({ formNumber: 1, perfectVowel: "a", imperfectVowel: null }), [
    "Form I needs both a perfect and an imperfect vowel",
  ]);
  assert.deepEqual(vowelIssues({ formNumber: 1, perfectVowel: null, imperfectVowel: null }), [
    "Form I needs both a perfect and an imperfect vowel",
  ]);
  assert.deepEqual(vowelIssues({ formNumber: 4, perfectVowel: "a", imperfectVowel: null }), [
    "Perfect/imperfect vowels only apply to form I",
  ]);
});

test("the login redirect keeps same-origin paths and refuses everything that could leave the site", () => {
  for (const safe of ["/", "/admin", "/admin/entries?page=2", "/entry/%D9%83"]) {
    assert.equal(getSafeNextPath(safe), safe, safe);
  }
  for (const unsafe of [
    "",
    "admin",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/a\nb",
    "/a\u0000b",
    null,
    undefined,
  ]) {
    assert.equal(getSafeNextPath(unsafe), null, String(unsafe));
  }
  assert.equal(resolveLoginRedirect("/admin/entries", "", "https://tasrif.xyz"), "/admin/entries");
  assert.equal(resolveLoginRedirect(null, "https://tasrif.xyz/admin/entries", "https://tasrif.xyz"), "/admin");
  assert.equal(resolveLoginRedirect(null, "https://tasrif.xyz/entry/book", "https://tasrif.xyz"), "/");
  assert.equal(resolveLoginRedirect(null, "https://evil.example/admin", "https://tasrif.xyz"), "/");
  assert.equal(resolveLoginRedirect("//evil.example", "https://tasrif.xyz/admin", "https://tasrif.xyz"), "/admin");
  assert.equal(resolveLoginRedirect(null, "not a url", "https://tasrif.xyz"), "/");
  assert.equal(resolveLoginRedirect(null, "https://tasrif.xyz/administrator", "https://tasrif.xyz"), "/");
});

test("isNonEmptyString narrows only real strings", () => {
  assert.equal(isNonEmptyString("a"), true);
  for (const value of ["", null, undefined]) {
    assert.equal(isNonEmptyString(value), false);
  }
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const option = (id: number) => ({ id, text: `word ${id}`, pos: "noun" as const, language: "en" as const });

test("sense lookups made in the same tick are sent as one batched request", async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    const ids = new URL(String(input), "http://x").searchParams.get("ids")?.split(",").map(Number) ?? [];
    return Response.json({ items: ids.filter((id) => id !== 3).map(option), hasMore: false });
  }) as typeof fetch;

  const [one, two, three] = await Promise.all([lookupSense(1001), lookupSense(1002), lookupSense(3)]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0], "/api/senses/search?ids=1001%2C1002%2C3");
  assert.deepEqual(one, option(1001));
  assert.deepEqual(two, option(1002));
  assert.equal(three, null);
});

test("a repeated lookup is served from the cache and a remembered sense needs no request", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return Response.json({ items: [option(2001)], hasMore: false });
  }) as typeof fetch;
  assert.deepEqual(await lookupSense(2001), option(2001));
  assert.deepEqual(await lookupSense(2001), option(2001));
  assert.equal(calls, 1);

  rememberSense(option(2002));
  assert.deepEqual(await lookupSense(2002), option(2002));
  assert.equal(calls, 1);
});

test("a large batch is split into requests the server accepts", async () => {
  const sizes: number[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const ids = new URL(String(input), "http://x").searchParams.get("ids")?.split(",").map(Number) ?? [];
    sizes.push(ids.length);
    return Response.json({ items: ids.map(option), hasMore: false });
  }) as typeof fetch;
  const total = SENSE_SEARCH_MAX_LIMIT + 7;
  const results = await Promise.all(Array.from({ length: total }, (_, index) => lookupSense(3000 + index)));
  assert.deepEqual(sizes, [SENSE_SEARCH_MAX_LIMIT, 7]);
  assert.ok(results.every((result, index) => result?.id === 3000 + index));
});

test("a failed batch resolves to nothing and is not cached, so a later lookup retries", async () => {
  const logged: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
    assert.equal(await lookupSense(4001), null);
    assert.equal(logged.length, 1);

    globalThis.fetch = (async () => Response.json({ items: [option(4001)], hasMore: false })) as typeof fetch;
    assert.deepEqual(await lookupSense(4001), option(4001));
  } finally {
    console.error = originalError;
  }
});

test("a null character is found in strings, nested objects and arrays but not elsewhere", () => {
  assert.equal(containsNul("a\u0000"), true);
  assert.equal(containsNul({ a: [{ b: ["fine", "x\u0000"] }] }), true);
  assert.equal(containsNul({ a: [{ b: ["fine"] }], n: 5, nil: null, flag: false }), false);
  assert.equal(containsNul(["\u0001", "\\0", "\u0000".length]), false);
  assert.equal(containsNul(undefined), false);
  assert.equal(containsNul(Number.NaN), false);
});
