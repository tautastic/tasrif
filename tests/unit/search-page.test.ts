import assert from "node:assert/strict";
import { test } from "node:test";
import { findTags, renderMarkup } from "./public-render.ts";
import { openRepository } from "./repository-db.ts";

const { sql } = await openRepository();

const { default: SearchPage } = await import("~/app/search/page");

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

const addEntries = async (prefix: string, count: number) => {
  const slugs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const text = `${prefix}${String(index).padStart(2, "0")}`;
    await sql.exec("INSERT INTO lexical_entry (language, text, is_verified) VALUES ('en', $1, true)", [text]);
    slugs.push(`/entry/${text}`);
  }
  return slugs;
};

const many = await addEntries("bo", 45);
const exactlyOnePage = await addEntries("ex", 20);

const render = async (q: string, page?: string) => {
  const html = renderMarkup(await SearchPage({ searchParams: Promise.resolve({ q, page }) }));
  const anchors = findTags(html, "a");
  return {
    entries: anchors.map((anchor) => anchor.attributes.href ?? "").filter((href) => href.startsWith("/entry/")),
    hasNext: anchors.some((anchor) => anchor.attributes.rel === "next"),
  };
};

test("the first page lists the first twenty results and links to the next page", async () => {
  const result = await render("bo");
  assert.deepEqual(result.entries, many.slice(0, 20));
  assert.equal(result.hasNext, true);
});

test("a later page lists its own twenty results, not the earlier ones", async () => {
  const result = await render("bo", "2");
  assert.deepEqual(result.entries, many.slice(20, 40));
  assert.equal(result.hasNext, true);
});

test("the last page lists what is left and has no next page", async () => {
  const result = await render("bo", "3");
  assert.deepEqual(result.entries, many.slice(40));
  assert.equal(result.hasNext, false);
});

test("exactly one page of results has no next page", async () => {
  const result = await render("ex");
  assert.deepEqual(result.entries, exactlyOnePage);
  assert.equal(result.hasNext, false);
});

test("a page past the results and a page past the page limit are a 404", async () => {
  await assert.rejects(render("bo", "4"), isNotFound);
  await assert.rejects(render("bo", "6"), isNotFound);
});

test("a query without results shows no entries on the first page", async () => {
  assert.deepEqual(await render("zz"), { entries: [], hasNext: false });
});
