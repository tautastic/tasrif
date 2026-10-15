import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  buildPageMetadata,
  countSitemapPages,
  DEFAULT_OPEN_GRAPH,
  getSiteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITEMAP_PAGE_SIZE,
} from "~/app/site";

const originalSiteUrl = process.env.SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.SITE_URL;
  } else {
    process.env.SITE_URL = originalSiteUrl;
  }
});

test("getSiteUrl falls back to the default domain when SITE_URL is unset or blank", () => {
  delete process.env.SITE_URL;
  assert.equal(getSiteUrl(), "https://tasrif.xyz");
  process.env.SITE_URL = "   ";
  assert.equal(getSiteUrl(), "https://tasrif.xyz");
});

test("getSiteUrl reads the environment on every call so one build can serve any domain", () => {
  process.env.SITE_URL = "https://one.example";
  assert.equal(getSiteUrl(), "https://one.example");
  process.env.SITE_URL = "https://two.example";
  assert.equal(getSiteUrl(), "https://two.example");
});

test("getSiteUrl normalises trailing slashes, whitespace and keeps a path prefix", () => {
  process.env.SITE_URL = "  https://one.example/  ";
  assert.equal(getSiteUrl(), "https://one.example");
  process.env.SITE_URL = "https://one.example///";
  assert.equal(getSiteUrl(), "https://one.example");
  process.env.SITE_URL = "https://one.example/dictionary/";
  assert.equal(getSiteUrl(), "https://one.example/dictionary");
  process.env.SITE_URL = "http://localhost:3000";
  assert.equal(getSiteUrl(), "http://localhost:3000");
});

test("getSiteUrl ignores a value that is not a valid URL", () => {
  process.env.SITE_URL = "not a url";
  assert.equal(getSiteUrl(), "https://tasrif.xyz");
  process.env.SITE_URL = "tasrif.example";
  assert.equal(getSiteUrl(), "https://tasrif.xyz");
});

test("buildPageMetadata keeps URLs relative so they resolve against the runtime site URL", () => {
  const metadata = buildPageMetadata({
    title: "Arabic Entries",
    description: "Browse the Arabic entries.",
    path: "/lang/ar?page=2",
  });
  assert.equal(metadata.title, "Arabic Entries");
  assert.equal(metadata.description, "Browse the Arabic entries.");
  assert.deepEqual(metadata.alternates, { canonical: "/lang/ar?page=2" });
  assert.equal(metadata.openGraph?.url, "/lang/ar?page=2");
  assert.equal(metadata.openGraph?.title, `Arabic Entries — ${SITE_NAME}`);
  assert.equal(metadata.openGraph?.description, "Browse the Arabic entries.");
  assert.deepEqual(metadata.openGraph?.images, [
    { url: "/android-chrome-512x512.png", width: 512, height: 512, alt: SITE_NAME },
  ]);
  assert.equal(metadata.robots, undefined);
});

test("buildPageMetadata marks pages as noindex only on request", () => {
  const indexed = buildPageMetadata({ title: "t", description: "d", path: "/search" });
  const hidden = buildPageMetadata({ title: "t", description: "d", path: "/search", noIndex: true });
  assert.equal(indexed.robots, undefined);
  assert.deepEqual(hidden.robots, { index: false, follow: true });
});

test("the default Open Graph data points at the home page with relative URLs", () => {
  assert.equal(DEFAULT_OPEN_GRAPH.url, "/");
  assert.equal(DEFAULT_OPEN_GRAPH.siteName, SITE_NAME);
  assert.equal(DEFAULT_OPEN_GRAPH.description, SITE_DESCRIPTION);
});

test("countSitemapPages always reports at least one sitemap and rounds up", () => {
  assert.equal(countSitemapPages(0), 1);
  assert.equal(countSitemapPages(1), 1);
  assert.equal(countSitemapPages(SITEMAP_PAGE_SIZE), 1);
  assert.equal(countSitemapPages(SITEMAP_PAGE_SIZE + 1), 2);
  assert.equal(countSitemapPages(SITEMAP_PAGE_SIZE * 3), 3);
  assert.equal(countSitemapPages(SITEMAP_PAGE_SIZE * 3 + 1), 4);
});
