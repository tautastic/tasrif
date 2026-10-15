import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installFakeIncrementalCache } from "./public-fake-cache.ts";
import "./public-render.ts";
import { openRepository } from "./repository-db.ts";

const { sql } = await openRepository();
const cache = installFakeIncrementalCache();

const { SITEMAP_PAGE_SIZE } = await import("~/app/site");
const sitemapModule = await import("~/app/sitemap");
const { default: robots } = await import("~/app/robots");
const sitemapQueries = await import("~/server/db/repository/lexical-entry/sitemap");

const SLUG_COUNT = SITEMAP_PAGE_SIZE + 3;
const originalSiteUrl = process.env.SITE_URL;

await sql.exec(
  `INSERT INTO lexical_entry (language, text, is_verified)
   SELECT 'en', 'slug' || lpad(n::text, 5, '0'), true FROM generate_series(1, ${SLUG_COUNT}) AS n`,
);
await sql.exec(
  `INSERT INTO lexical_entry (language, text, is_verified) VALUES
     ('en', 'Slug00001', true),
     ('en', 'hidden draft', false),
     ('ar', 'كِتَاب', true),
     ('ar', 'كُتَّاب', true),
     ('en', 'a lot', true),
     ('en', 'alot', true)`,
);

const EXPECTED_DISTINCT = SLUG_COUNT + 3;

afterEach(() => {
  cache.clear();
  cache.sets.length = 0;
  if (originalSiteUrl === undefined) {
    delete process.env.SITE_URL;
  } else {
    process.env.SITE_URL = originalSiteUrl;
  }
});

const urlsOf = (entries: Array<{ url: string }>) => entries.map((entry) => entry.url);

test("the sitemap query counts distinct verified slugs", async () => {
  assert.equal(await sitemapQueries.countSitemapEntrySlugs(), EXPECTED_DISTINCT);
});

test("the sitemap query returns distinct verified slugs in a stable order, one chunk at a time", async () => {
  const all = await sitemapQueries.getSitemapEntrySlugs({ offset: 0, limit: 100000 });
  assert.equal(all.length, EXPECTED_DISTINCT);
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.includes("hidden-draft"), false);
  assert.deepEqual(
    all,
    await sql.column<string>("SELECT DISTINCT slug FROM lexical_entry WHERE is_verified ORDER BY slug"),
  );
  const first = await sitemapQueries.getSitemapEntrySlugs({ offset: 0, limit: 4 });
  const second = await sitemapQueries.getSitemapEntrySlugs({ offset: 4, limit: 4 });
  assert.deepEqual([...first, ...second], all.slice(0, 8));
  assert.deepEqual(await sitemapQueries.getSitemapEntrySlugs({ offset: EXPECTED_DISTINCT, limit: 10 }), []);
});

test("phrases that used to collide are two sitemap entries with hyphenated slugs", async () => {
  const all = await sitemapQueries.getSitemapEntrySlugs({ offset: 0, limit: 100000 });
  assert.ok(all.includes("a-lot"));
  assert.ok(all.includes("alot"));
  assert.equal(
    all.some((slug) => /\s/.test(slug)),
    false,
  );
});

test("generateSitemaps announces one sitemap per started chunk of slugs", async () => {
  assert.deepEqual(await sitemapModule.generateSitemaps(), [{ id: 0 }, { id: 1 }]);
});

test("generateSitemaps does not touch the database during the production build", async () => {
  const previous = process.env.NEXT_PHASE;
  process.env.NEXT_PHASE = "phase-production-build";
  try {
    assert.deepEqual(await sitemapModule.generateSitemaps(), [{ id: 0 }]);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = previous;
    }
  }
});

test("the first sitemap holds the static pages and a full chunk of entries, the last holds the remainder", async () => {
  process.env.SITE_URL = "https://one.example";
  const first = urlsOf(await sitemapModule.default({ id: Promise.resolve("0") }));
  assert.equal(first.length, 5 + SITEMAP_PAGE_SIZE);
  assert.deepEqual(first.slice(0, 5), [
    "https://one.example/",
    "https://one.example/lang/ar",
    "https://one.example/lang/en",
    "https://one.example/arabic-verb-form",
    "https://one.example/appendix/arabic-verbs",
  ]);
  const second = urlsOf(await sitemapModule.default({ id: Promise.resolve("1") }));
  assert.equal(second.length, EXPECTED_DISTINCT - SITEMAP_PAGE_SIZE);
  assert.ok(second.every((url) => url.startsWith("https://one.example/entry/")));
  assert.equal(new Set([...first.slice(5), ...second]).size, EXPECTED_DISTINCT);
});

test("sitemap URLs follow SITE_URL at request time and percent-encode Arabic slugs", async () => {
  process.env.SITE_URL = "https://one.example";
  const one = urlsOf(await sitemapModule.default({ id: Promise.resolve("0") }));
  process.env.SITE_URL = "https://two.example/";
  const two = urlsOf(await sitemapModule.default({ id: Promise.resolve("0") }));
  const twoLast = urlsOf(await sitemapModule.default({ id: Promise.resolve("1") }));
  assert.equal(one.length, two.length);
  assert.ok(one.every((url) => url.startsWith("https://one.example/")));
  assert.ok([...two, ...twoLast].every((url) => url.startsWith("https://two.example/")));
  assert.ok(twoLast.includes("https://two.example/entry/%D9%83%D8%AA%D8%A7%D8%A8"));
});

test("ids past the last sitemap or malformed ids produce an empty sitemap without caching a chunk per id", async () => {
  for (const id of ["2", "99999", "-1", "1.5", "abc"]) {
    assert.deepEqual(await sitemapModule.default({ id: Promise.resolve(id) }), [], JSON.stringify(id));
  }
  assert.equal(
    cache.sets.some((set) => set.key.includes("sitemap-slugs")),
    false,
  );
});

test("robots.txt disallows the private areas and lists every sitemap under the runtime site URL", async () => {
  process.env.SITE_URL = "https://one.example";
  const one = await robots();
  assert.deepEqual(one.rules, { userAgent: "*", allow: "/", disallow: ["/admin", "/auth", "/api"] });
  assert.deepEqual(one.sitemap, ["https://one.example/sitemap/0.xml", "https://one.example/sitemap/1.xml"]);
  process.env.SITE_URL = "https://two.example";
  assert.deepEqual((await robots()).sitemap, [
    "https://two.example/sitemap/0.xml",
    "https://two.example/sitemap/1.xml",
  ]);
});

test("robots.txt and the sitemaps read the entry count through the tagged cache", async () => {
  cache.sets.length = 0;
  await robots();
  await sitemapModule.default({ id: Promise.resolve("0") });
  assert.ok(cache.sets.length >= 2);
  assert.ok(cache.sets.every((set) => set.tags.includes("public-data")));
});
