import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { installFakeIncrementalCache } from "./public-fake-cache.ts";
import { findTags, renderMarkup, textOf } from "./public-render.ts";
import { openRepository } from "./repository-db.ts";

const { sql } = await openRepository();
const cache = installFakeIncrementalCache();

const queries = await import("~/server/cache/public-queries");
const { default: VerbFormPage, generateMetadata } = await import("~/app/arabic-verb-form/[slug]/page");
const { default: VerbFormsPage } = await import("~/app/arabic-verb-form/page");
const { default: EntryPage } = await import("~/app/entry/[slug]/page");
const { default: RootPage } = await import("~/app/root/[slug]/page");
const { default: FormReference } = await import("~/components/entry/FormReference");

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

const formPage = (slug: string, page?: string) =>
  VerbFormPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(page ? { page } : {}) });

const quadPatternId = await sql.scalar<number>(
  "SELECT id FROM morph_pattern WHERE form_number = 1 AND radical_count = 4 ORDER BY id LIMIT 1",
);
const triPatternId = await sql.scalar<number>(
  "SELECT id FROM morph_pattern WHERE form_number = 1 AND radical_count = 3 ORDER BY id LIMIT 1",
);

const addVerb = async (text: string, root: string, patternId: number, verified: boolean) => {
  const id = await sql.scalar<number>(
    `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified)
     VALUES ('ar', $1, $2, $3, $4) RETURNING id`,
    [text, root, patternId, verified],
  );
  await sql.exec(
    "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, 'verb', 1, ARRAY['to roll'])",
    [id],
  );
  return id;
};

const rolled = await addVerb("دَحْرَجَ", "دحرج", quadPatternId, true);
await addVerb("بَعْثَرَ", "بعثر", quadPatternId, false);
await addVerb("كَتَبَ", "كتب", triPatternId, true);

afterEach(() => {
  cache.clear();
  cache.sets.length = 0;
  cache.hits = 0;
});

test("the four-radical form is a page of its own beside the three-radical one, with its own entries", async () => {
  const quad = renderMarkup(await formPage("1q"));
  assert.ok(textOf(quad).includes("دَحْرَجَ"));
  assert.equal(textOf(quad).includes("كَتَبَ"), false);
  assert.equal(textOf(quad).includes("بَعْثَرَ"), false);
  assert.ok(textOf(quad).includes("Form Iq"));
  assert.match(textOf(quad), /out of 1 total/);

  const tri = renderMarkup(await formPage("1"));
  assert.ok(textOf(tri).includes("كَتَبَ"));
  assert.equal(textOf(tri).includes("دَحْرَجَ"), false);
  assert.ok(textOf(tri).includes("Form I"));
  assert.equal(textOf(tri).includes("Form Iq"), false);
});

test("the index lists each populated form once and links the four-radical form with its q", async () => {
  const index = renderMarkup(await VerbFormsPage());
  assert.deepEqual(
    findTags(index, "a").map((anchor) => anchor.attributes.href),
    ["/arabic-verb-form/1", "/arabic-verb-form/1q"],
  );
  assert.match(textOf(index), /Form I \(1 entry\) Form Iq \(1 entry\)/);
});

test("a four-radical form that has no entries, or no such form, is a 404", async () => {
  for (const slug of ["2q", "4q", "5q", "0q", "q", "1qq", "1Q", "q1", "-1q"]) {
    await assert.rejects(formPage(slug), isNotFound, slug);
  }
  await assert.rejects(formPage("1q", "2"), isNotFound);
  assert.equal(
    cache.sets.some((set) => set.key.includes("form-page") && set.key.includes("5")),
    false,
  );
});

test("the form page metadata names the form with its q and keeps the q in the canonical path", async () => {
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "1q" }),
    searchParams: Promise.resolve({}),
  });
  assert.equal(metadata.title, "Arabic Verb Form Iq");
  assert.deepEqual(metadata.alternates, { canonical: "/arabic-verb-form/1q" });
  assert.equal(metadata.description, "Arabic verbs of Form Iq in the Tasrif dictionary.");
});

test("the cached form list tells the two radical counts apart", async () => {
  const forms = await queries.getCachedVerbForms();
  assert.deepEqual(
    forms.map((form) => ({ formNumber: form.formNumber, radicalCount: form.radicalCount ?? 3, total: form.total })),
    [
      { formNumber: 1, radicalCount: 3, total: 1 },
      { formNumber: 1, radicalCount: 4, total: 1 },
    ],
  );
});

test("the entry page of a four-radical verb shows the four-letter root, its form and its derived forms", async () => {
  const html = renderMarkup(await EntryPage({ params: Promise.resolve({ slug: encodeURIComponent("دحرج") }) }));
  assert.ok(findTags(html, "div").some((tag) => tag.attributes.id === `entry-${rolled}`));
  const rootLinks = findTags(html, "a").filter((anchor) => anchor.attributes.href === "/root/%D8%AF%D8%AD%D8%B1%D8%AC");
  assert.ok(rootLinks.length >= 1);
  assert.ok(textOf(html).includes("د-ح-ر-ج"));
  assert.ok(textOf(html).includes("(d-ḥ-r-j)"));
  const formLink = findTags(html, "a").find((anchor) => anchor.attributes.href?.startsWith("/appendix/arabic-verbs"));
  assert.equal(formLink?.attributes.href, "/appendix/arabic-verbs");
  assert.ok(textOf(html).includes("Form Iq"));
  assert.ok(textOf(html).includes("دَحْرَجَ"));
  assert.ok(textOf(html).includes("يُدَحْرِجُ"));
  assert.ok(textOf(html).includes("دَحْرَجَة"));
});

test("the root page of a four-letter root lists its entry and spells the root with four letters", async () => {
  const html = renderMarkup(
    await RootPage({
      params: Promise.resolve({ slug: encodeURIComponent("دحرج") }),
      searchParams: Promise.resolve({}),
    }),
  );
  assert.ok(textOf(html).includes("د-ح-ر-ج"));
  assert.ok(textOf(html).includes("دَحْرَجَ"));
  assert.match(textOf(html), /out of 1 total/);
});

test("a form reference to a four-radical form carries the q and points at the appendix without a section", () => {
  const quad = findTags(renderMarkup(createElement(FormReference, { formNumber: 1, radicalCount: 4 })), "a")[0];
  assert.equal(quad?.attributes.href, "/appendix/arabic-verbs");
  assert.equal(textOf(renderMarkup(createElement(FormReference, { formNumber: 3, radicalCount: 4 }))), "Form IIIq");

  const tri = findTags(renderMarkup(createElement(FormReference, { formNumber: 3 })), "a")[0];
  assert.equal(tri?.attributes.href, "/appendix/arabic-verbs#Form_III");
  assert.equal(textOf(renderMarkup(createElement(FormReference, { formNumber: 3, radicalCount: 3 }))), "Form III");
});
