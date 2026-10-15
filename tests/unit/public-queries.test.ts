import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installFakeIncrementalCache } from "./public-fake-cache.ts";
import { findTags, renderMarkup, textOf } from "./public-render.ts";
import { openRepository } from "./repository-db.ts";

const { sql } = await openRepository();
const cache = installFakeIncrementalCache();

const queries = await import("~/server/cache/public-queries");
const { PUBLIC_DATA_TAG } = await import("~/server/cache/tags");
const { default: LangPage } = await import("~/app/lang/[lang]/page");
const { default: VerbFormPage } = await import("~/app/arabic-verb-form/[slug]/page");
const { default: VerbFormsPage } = await import("~/app/arabic-verb-form/page");

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

const formOnePatternId = await sql.scalar<number>(
  "SELECT id FROM morph_pattern WHERE form_number = 1 ORDER BY id LIMIT 1",
);

await sql.exec(
  `INSERT INTO lexical_entry (language, text, is_verified)
   SELECT 'en', 'word' || lpad(n::text, 3, '0'), true FROM generate_series(1, 5) AS n`,
);
await sql.exec(
  `INSERT INTO lexical_entry (language, text, is_verified)
   SELECT 'ar', 'كلمة' || n, n <> 4 FROM generate_series(1, 6) AS n`,
);
await sql.exec(
  `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified)
   VALUES ('ar', 'كَتَبَ', 'كتب', ${formOnePatternId}, true), ('ar', 'نَصَرَ', 'نصر', ${formOnePatternId}, false)`,
);

const verifiedIds = (language: "ar" | "en") =>
  sql.column<number>(
    "SELECT id FROM lexical_entry WHERE language = $1 AND is_verified ORDER BY created_at DESC, id DESC",
    [language],
  );

afterEach(() => {
  cache.clear();
  cache.sets.length = 0;
  cache.hits = 0;
});

test("recent entries are verified only, newest first, and reduced to plain JSON-safe fields", async () => {
  const recent = await queries.getCachedRecentEntries();
  const expected = await sql.column<number>(
    "SELECT id FROM lexical_entry WHERE is_verified ORDER BY created_at DESC, id DESC LIMIT 10",
  );
  assert.deepEqual(
    recent.map((entry) => entry.id),
    expected,
  );
  for (const entry of recent) {
    assert.deepEqual(Object.keys(entry).sort(), ["id", "language", "slug", "text"]);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(recent)), recent);
});

test("language listings page without gaps or repeats and report the verified total", async () => {
  for (const language of ["ar", "en"] as const) {
    const ids = await verifiedIds(language);
    assert.equal(await queries.getCachedLanguageTotal(language), ids.length);
    const seen: number[] = [];
    for (let page = 1; page <= Math.ceil(ids.length / 2); page++) {
      const result = await queries.getCachedLanguagePage(language, page, 2);
      assert.equal(result.total, ids.length);
      assert.ok(result.items.length <= 2);
      assert.ok(result.items.every((item) => item.language === language));
      seen.push(...result.items.map((item) => item.id));
    }
    assert.deepEqual(seen, ids);
  }
});

test("verb form listings count verified entries per form and omit empty forms", async () => {
  const forms = await queries.getCachedVerbForms();
  const verifiedFormOne = await sql.scalar<number>(
    "SELECT count(*)::int FROM lexical_entry WHERE is_verified AND morph_pattern_id IN (SELECT id FROM morph_pattern WHERE form_number = 1)",
  );
  assert.deepEqual(forms, [{ formNumber: 1, total: verifiedFormOne }]);
  const page = await queries.getCachedFormPage(1, 1, 10);
  assert.equal(page.total, verifiedFormOne);
  assert.deepEqual(
    page.items.map((item) => item.text),
    ["كَتَبَ"],
  );
});

test("random entries are distinct, verified and JSON-safe", async () => {
  const random = await queries.getCachedRandomEntries();
  const verified = new Set([...(await verifiedIds("ar")), ...(await verifiedIds("en"))]);
  assert.equal(new Set(random.map((entry) => entry.id)).size, random.length);
  assert.ok(random.length > 0);
  assert.ok(random.every((entry) => verified.has(entry.id)));
  assert.deepEqual(JSON.parse(JSON.stringify(random)), random);
});

test("a second call is served from the cache and stays stale until the public data tag is expired", async () => {
  const before = await queries.getCachedLanguageTotal("en");
  await sql.exec("INSERT INTO lexical_entry (language, text, is_verified) VALUES ('en', 'freshword', true)");
  assert.equal(await queries.getCachedLanguageTotal("en"), before);
  assert.ok(cache.hits >= 1);
  cache.expireTag(PUBLIC_DATA_TAG);
  assert.equal(await queries.getCachedLanguageTotal("en"), before + 1);
  const recent = await queries.getCachedRecentEntries();
  assert.ok(recent.some((entry) => entry.text === "freshword"));
});

test("every cached query is tagged for invalidation and has a bounded lifetime", async () => {
  await queries.getCachedRecentEntries();
  await queries.getCachedRandomEntries();
  await queries.getCachedLanguageTotal("ar");
  await queries.getCachedLanguagePage("ar", 1, 5);
  await queries.getCachedVerbForms();
  await queries.getCachedFormPage(1, 1, 5);
  await queries.getCachedSitemapSlugCount();
  await queries.getCachedSitemapSlugs(0, 5);
  assert.equal(cache.sets.length, 8);
  for (const set of cache.sets) {
    assert.deepEqual(set.tags, [PUBLIC_DATA_TAG], set.key);
    assert.equal(typeof set.revalidate, "number", set.key);
  }
  const random = cache.sets.find((set) => set.key.includes("random-entries"));
  assert.equal(random?.revalidate, 60);
  assert.ok(cache.sets.filter((set) => set !== random).every((set) => set.revalidate === 3600));
});

test("an out-of-range language page is a 404 without creating a cache entry per page number", async () => {
  await assert.rejects(
    LangPage({ params: Promise.resolve({ lang: "ar" }), searchParams: Promise.resolve({ page: "99999" }) }),
    isNotFound,
  );
  assert.equal(
    cache.sets.some((set) => set.key.includes("language-page")),
    false,
  );
  await assert.rejects(
    LangPage({ params: Promise.resolve({ lang: "xx" }), searchParams: Promise.resolve({}) }),
    isNotFound,
  );
});

test("an in-range language page renders the cached entries with pagination", async () => {
  const element = await LangPage({
    params: Promise.resolve({ lang: "en" }),
    searchParams: Promise.resolve({ page: "1" }),
  });
  const html = renderMarkup(element);
  const links = findTags(html, "a").filter((anchor) => anchor.attributes.href?.startsWith("/entry/"));
  assert.equal(links.length, (await verifiedIds("en")).length);
  assert.match(textOf(html), /out of \d+ total/);
  assert.equal(findTags(html, "h1").length, 1);
});

test("unknown verb forms are a 404 without creating a cache entry per form number", async () => {
  for (const slug of ["2", "999999", "0", "abc", "1.5"]) {
    await assert.rejects(
      VerbFormPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }),
      isNotFound,
      slug,
    );
  }
  assert.equal(
    cache.sets.some((set) => set.key.includes("form-page")),
    false,
  );
  await assert.rejects(
    VerbFormPage({ params: Promise.resolve({ slug: "1" }), searchParams: Promise.resolve({ page: "5" }) }),
    isNotFound,
  );
});

test("a known verb form renders its entries and the index lists only populated forms", async () => {
  const element = await VerbFormPage({ params: Promise.resolve({ slug: "1" }), searchParams: Promise.resolve({}) });
  const html = renderMarkup(element);
  assert.ok(textOf(html).includes("كَتَبَ"));
  assert.equal(textOf(html).includes("نَصَرَ"), false);
  assert.ok(html.includes('<span lang="ar">كَتَبَ</span>'));
  const index = renderMarkup(await VerbFormsPage());
  assert.deepEqual(
    findTags(index, "a").map((anchor) => anchor.attributes.href),
    ["/arabic-verb-form/1"],
  );
});
