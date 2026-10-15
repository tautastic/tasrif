import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { makeConjugation } from "./public-fixtures.ts";
import { findTags, renderMarkup, textOf } from "./public-render.ts";

const { default: AlternativeForms } = await import("~/components/entry/AlternativeForms");
const { default: ConjugationTable } = await import("~/components/entry/ConjugationTable");
const { alternativeFormsFor, alternativeNounsFor } = await import("~/lib/alternative-forms");

test("no alternative renders nothing at all", () => {
  assert.equal(renderMarkup(createElement(AlternativeForms, { forms: [] })), "");
});

test("alternatives are a labelled list of Arabic spans, one item per form, in the given order", () => {
  const html = renderMarkup(createElement(AlternativeForms, { forms: ["يَمُدِّ", "يَمْدُدْ"] }));
  const [list] = findTags(html, "ul");
  assert.ok(list);
  assert.equal(list.attributes["aria-label"], "Alternative forms");
  assert.equal(findTags(html, "li").length, 2);
  assert.deepEqual(
    [...html.matchAll(/<li><span lang="ar">([^<]*)<\/span><\/li>/g)].map((match) => match[1]),
    ["يَمُدِّ", "يَمْدُدْ"],
  );
  assert.equal(textOf(html), "يَمُدِّ يَمْدُدْ");
  assert.equal(findTags(html, "span").filter((span) => span.attributes.lang === "ar").length, 2);
});

test("the lookup finds the forms of one cell and is empty for every other cell", () => {
  const alternatives = {
    imperfect_jussive: { third_person_masculine_singular: ["يَمُدِّ", "يَمْدُدْ"] },
    imperative: { second_person_masculine_singular: ["مُدَّ", "مُدِّ"] },
  } as const;
  assert.deepEqual(alternativeFormsFor(alternatives, "imperfect_jussive", "third_person_masculine_singular"), [
    "يَمُدِّ",
    "يَمْدُدْ",
  ]);
  assert.deepEqual(alternativeFormsFor(alternatives, "imperative", "second_person_masculine_singular"), ["مُدَّ", "مُدِّ"]);
  assert.deepEqual(alternativeFormsFor(alternatives, "perfect", "third_person_masculine_singular"), []);
  assert.deepEqual(alternativeFormsFor(alternatives, "imperative", "second_person_dual"), []);
  assert.deepEqual(alternativeFormsFor(alternatives, "imperative", undefined), []);
  assert.deepEqual(alternativeFormsFor(undefined, "imperative", "second_person_dual"), []);
});

test("the lookup of the verbal nouns finds the forms of one kind and is empty for every other kind", () => {
  const nouns = { masdar: ["زِلْزَال"] } as const;
  assert.deepEqual(alternativeNounsFor(nouns, "masdar"), ["زِلْزَال"]);
  assert.deepEqual(alternativeNounsFor(nouns, "active_participle"), []);
  assert.deepEqual(alternativeNounsFor(nouns, "passive_participle"), []);
  assert.deepEqual(alternativeNounsFor(undefined, "masdar"), []);
});

const principalParts = (alternativeNouns?: { masdar?: readonly string[] }) =>
  renderMarkup(
    createElement(ConjugationTable, {
      word: "زَلْزَلَ",
      patternFormNumber: 1,
      patternRadicalCount: 4,
      patternDescription: "quadriliteral form I",
      masdar: "زَلْزَلَة",
      activeParticiple: "مُزَلْزِل",
      passiveParticiple: "مُزَلْزَل",
      conjugations: [],
      alternativeNouns,
    }),
  );

test("a second verbal noun is listed under the verbal noun in the table of principal parts", () => {
  const html = principalParts({ masdar: ["زِلْزَال"] });
  const [list] = findTags(html, "ul");
  assert.ok(list);
  assert.equal(list.attributes["aria-label"], "Alternative forms");
  assert.equal(findTags(html, "ul").length, 1);
  const row = html.split("<tr>").find((candidate) => candidate.includes("verbal noun"));
  assert.ok(row);
  assert.ok(row.includes("زَلْزَلَة"));
  assert.ok(row.includes("زِلْزَال"));
  assert.ok(row.indexOf("زَلْزَلَة") < row.indexOf("زِلْزَال"));
  const participles = html.split("<tr>").filter((candidate) => candidate.includes("participle"));
  assert.equal(participles.length, 2);
  assert.ok(participles.every((candidate) => !candidate.includes("<ul")));
});

test("without alternative nouns the principal parts show no list", () => {
  assert.equal(findTags(principalParts(), "ul").length, 0);
  assert.equal(findTags(principalParts({}), "ul").length, 0);
});

const withPassiveAlternatives = (alternatives?: object, passiveAlternatives?: object) =>
  renderMarkup(
    createElement(ConjugationTable, {
      word: "مَدَّ",
      patternFormNumber: 1,
      patternDescription: "a ~ u",
      masdar: null,
      activeParticiple: null,
      passiveParticiple: null,
      conjugations: [
        makeConjugation(1, 1, "imperfect_jussive", "third_person_masculine_singular", "يَمُدَّ"),
        { ...makeConjugation(1, 2, "imperfect_jussive", "third_person_masculine_singular", "يُمَدَّ"), voice: "passive" },
      ],
      alternatives,
      passiveAlternatives,
    }),
  );

test("the alternatives of the passive voice are listed in the passive block and the active ones in the active block", () => {
  const html = withPassiveAlternatives(
    { imperfect_jussive: { third_person_masculine_singular: ["يَمُدِّ"] } },
    { imperfect_jussive: { third_person_masculine_singular: ["يُمَدِّ", "يُمْدَدْ"] } },
  );
  const passiveAt = html.indexOf("<em>passive voice</em>");
  assert.ok(passiveAt > 0);
  const active = html.slice(0, passiveAt);
  const passive = html.slice(passiveAt);
  assert.equal(findTags(active, "ul").length, 1);
  assert.equal(findTags(passive, "ul").length, 1);
  assert.ok(active.includes('<span lang="ar">يَمُدِّ</span>'));
  assert.ok(!active.includes("يُمَدِّ"));
  assert.ok(passive.includes('<span lang="ar">يُمَدِّ</span>'));
  assert.ok(passive.includes('<span lang="ar">يُمْدَدْ</span>'));
  assert.ok(!passive.includes('<span lang="ar">يَمُدِّ</span>'));
});

test("a table with passive alternatives only shows none in the active block", () => {
  const html = withPassiveAlternatives(undefined, { imperfect_jussive: { third_person_masculine_singular: ["يُمَدِّ"] } });
  const passiveAt = html.indexOf("<em>passive voice</em>");
  assert.equal(findTags(html.slice(0, passiveAt), "ul").length, 0);
  assert.equal(findTags(html.slice(passiveAt), "ul").length, 1);
});
