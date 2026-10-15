import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import type { ConjugationSelect } from "~/server/db/schema";
import { makeConjugation } from "./public-fixtures.ts";
import { findTags, renderMarkup, textOf } from "./public-render.ts";

const { default: ConjugationTable } = await import("~/components/entry/ConjugationTable");

const ARABIC = /[؀-ۿ]/;

const stripLangArabicSpans = (html: string): string => html.replace(/<span lang="ar">[^<]*<\/span>/g, "");

const ACTIVE_PERFECT = [
  ["first_person_singular", "كَتَبْتُ"],
  ["third_person_masculine_singular", "كَتَبَ"],
  ["third_person_feminine_singular", "كَتَبَتْ"],
] as const;

const PASSIVE_PERFECT = [
  ["first_person_singular", "كُتِبْتُ"],
  ["third_person_masculine_singular", "كُتِبَ"],
  ["third_person_feminine_singular", "كُتِبَتْ"],
] as const;

const PASSIVE_IMPERFECT = [
  ["third_person_masculine_singular", "يُكْتَبُ"],
  ["third_person_feminine_singular", "تُكْتَبُ"],
] as const;

const passiveRow = (
  id: number,
  mood: ConjugationSelect["mood"],
  person: ConjugationSelect["person"],
  form: string,
): ConjugationSelect => ({ ...makeConjugation(1, id, mood, person, form), voice: "passive" });

const withPassive = (): ConjugationSelect[] => [
  ...ACTIVE_PERFECT.map(([person, form], index) => makeConjugation(1, index + 1, "perfect", person, form)),
  ...PASSIVE_PERFECT.map(([person, form], index) => passiveRow(100 + index, "perfect", person, form)),
  ...PASSIVE_IMPERFECT.map(([person, form], index) => passiveRow(200 + index, "imperfect_indicative", person, form)),
];

const activeOnly = (): ConjugationSelect[] =>
  ACTIVE_PERFECT.map(([person, form], index) => makeConjugation(1, index + 1, "perfect", person, form));

const table = (word: string, conjugations: ConjugationSelect[]) =>
  createElement(ConjugationTable, {
    word,
    patternFormNumber: 1,
    patternDescription: "a ~ u",
    masdar: "كِتَابَة",
    activeParticiple: "كَاتِب",
    passiveParticiple: "مَكْتُوب",
    conjugations,
  });

test("a passive block follows the active block when passive rows exist", () => {
  const html = renderMarkup(table("كَتَبَ", withPassive()));
  const activeAt = html.indexOf("<em>active voice</em>");
  const passiveAt = html.indexOf("<em>passive voice</em>");
  assert.ok(activeAt > 0);
  assert.ok(passiveAt > activeAt);
  const passiveHtml = html.slice(passiveAt);
  for (const [, form] of [...PASSIVE_PERFECT, ...PASSIVE_IMPERFECT]) {
    assert.ok(passiveHtml.includes(`<span lang="ar">${form}</span>`), form);
    assert.equal(
      html.slice(0, passiveAt).includes(`<span lang="ar">${form}</span>`),
      false,
      `${form} is not in the active block`,
    );
  }
  for (const [, form] of ACTIVE_PERFECT) {
    assert.equal(passiveHtml.includes(`<span lang="ar">${form}</span>`), false, `${form} is not in the passive block`);
  }
  assert.ok(textOf(passiveHtml).includes("non-past (imperfect) indicative"));
  assert.equal(textOf(passiveHtml).includes("imperative"), false);
});

test("no passive block is rendered for an entry without passive rows", () => {
  const html = renderMarkup(table("كَتَبَ", activeOnly()));
  assert.equal(html.includes("passive voice"), false);
  assert.equal(html.includes("Passive voice"), false);
  assert.equal(findTags(html, "table").filter((candidate) => candidate.attributes["aria-labelledby"]).length, 1);
});

test("each voice has its own named, focusable scroll region", () => {
  const html = renderMarkup(table("كَتَبَ", withPassive()));
  const regions = findTags(html, "div").filter((div) => div.attributes.role === "region");
  assert.deepEqual(
    regions.map((region) => region.attributes["aria-label"]),
    ["Active voice conjugation of كَتَبَ", "Passive voice conjugation of كَتَبَ"],
  );
  assert.ok(regions.every((region) => region.attributes.tabindex === "0"));
});

test("region names stay unique across the words and voices of one page", () => {
  const html = renderMarkup(createElement(Fragment, null, table("كَتَبَ", withPassive()), table("قَرَأَ", withPassive())));
  const names = findTags(html, "div")
    .filter((div) => div.attributes.role === "region")
    .map((region) => region.attributes["aria-label"]);
  assert.equal(names.length, 4);
  assert.equal(new Set(names).size, 4);
});

test("each grid is labelled by its own voice heading and the ids are unique", () => {
  const html = renderMarkup(createElement(Fragment, null, table("كَتَبَ", withPassive()), table("قَرَأَ", withPassive())));
  const grids = findTags(html, "table").filter((candidate) => candidate.attributes["aria-labelledby"]);
  assert.equal(grids.length, 4);
  const labelIds = grids.map((grid) => grid.attributes["aria-labelledby"] ?? "");
  assert.equal(new Set(labelIds).size, 4);
  for (const labelId of labelIds) {
    const headings = findTags(html, "div").filter((div) => div.attributes.id === labelId);
    assert.equal(headings.length, 1);
  }
});

test("the passive block keeps scoped header cells and marks every Arabic string with lang=ar", () => {
  const html = renderMarkup(table("كَتَبَ", withPassive()));
  const passiveHtml = html.slice(html.indexOf("<em>passive voice</em>"));
  const headerCells = [...passiveHtml.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)];
  assert.ok(headerCells.length > 10);
  for (const [, attributes, content] of headerCells) {
    assert.match(attributes ?? "", /scope="(row|col|colgroup)"/);
    assert.notEqual(textOf(content ?? ""), "");
  }
  assert.equal(ARABIC.test(textOf(stripLangArabicSpans(passiveHtml))), false);
  assert.ok(passiveHtml.includes('<span lang="ar">الْفِعْل الْمَجْهُول</span>'));
});
