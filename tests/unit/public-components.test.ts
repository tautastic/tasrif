import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import { makeConjugation, makeEntry, makeSense } from "./public-fixtures.ts";
import { findTags, renderMarkup, textOf } from "./public-render.ts";

const { default: Pagination } = await import("~/components/Pagination");
const { default: ConjugationTable } = await import("~/components/entry/ConjugationTable");
const { default: EntryDetail } = await import("~/components/entry/entry-page/EntryDetail");
const { default: EntryHeader } = await import("~/components/entry/entry-page/EntryHeader");
const { default: SenseList } = await import("~/components/entry/entry-page/SenseList");
const { default: EntrySearchForm } = await import("~/components/entry/EntrySearchForm");
const { default: ErrorPage } = await import("~/app/error");
const { default: GlobalError } = await import("~/app/global-error");

const ARABIC = /[؀-ۿ]/;

const stripLangArabicSpans = (html: string): string => html.replace(/<span lang="ar">[^<]*<\/span>/g, "");

const pagination = (currentPage: number, totalPages: number, extraParams?: Record<string, string>) =>
  renderMarkup(createElement(Pagination, { currentPage, totalPages, basePath: "/lang/ar", extraParams }));

test("Pagination renders nothing for a single page", () => {
  assert.equal(pagination(1, 1), "");
  assert.equal(pagination(1, 0), "");
});

test("Pagination is a labelled navigation landmark with prev and next relations in the middle of a list", () => {
  const html = pagination(3, 8);
  const [nav] = findTags(html, "nav");
  assert.equal(nav?.attributes["aria-label"], "Pagination");
  const anchors = findTags(html, "a");
  const previous = anchors.find((anchor) => anchor.attributes.rel === "prev");
  const next = anchors.find((anchor) => anchor.attributes.rel === "next");
  assert.equal(previous?.attributes.href, "/lang/ar?page=2");
  assert.equal(previous?.attributes["aria-label"], "Previous page");
  assert.equal(next?.attributes.href, "/lang/ar?page=4");
  assert.equal(next?.attributes["aria-label"], "Next page");
  assert.equal(anchors.filter((anchor) => anchor.attributes.rel).length, 2);
});

test("Pagination marks exactly the current page and names every page link", () => {
  const anchors = findTags(pagination(4, 9), "a");
  const current = anchors.filter((anchor) => anchor.attributes["aria-current"] === "page");
  assert.equal(current.length, 1);
  assert.equal(current[0]?.attributes["aria-label"], "Page 4");
  const numbered = anchors.filter((anchor) => /^Page \d+$/.test(anchor.attributes["aria-label"] ?? ""));
  assert.deepEqual(
    numbered.map((anchor) => anchor.attributes["aria-label"]),
    ["Page 2", "Page 3", "Page 4", "Page 5", "Page 6"],
  );
});

test("Pagination replaces the unavailable step links with disabled text and drops rel", () => {
  const first = pagination(1, 4);
  assert.equal(
    findTags(first, "a").some((anchor) => anchor.attributes.rel === "prev"),
    false,
  );
  assert.equal(
    findTags(first, "a").some((anchor) => anchor.attributes.rel === "next"),
    true,
  );
  const disabledFirst = findTags(first, "span").filter((span) => span.attributes["aria-disabled"] === "true");
  assert.equal(disabledFirst.length, 1);
  assert.match(textOf(first), /^Previous 1 2 3 4 Next$/);

  const last = pagination(4, 4);
  assert.equal(
    findTags(last, "a").some((anchor) => anchor.attributes.rel === "next"),
    false,
  );
  assert.equal(
    findTags(last, "a").some((anchor) => anchor.attributes.rel === "prev"),
    true,
  );
  assert.equal(findTags(last, "span").filter((span) => span.attributes["aria-disabled"] === "true").length, 1);
});

test("Pagination shows a window of five pages around the current page", () => {
  assert.match(textOf(pagination(10, 20)), /^Previous 8 9 10 11 12 Next$/);
  assert.match(textOf(pagination(1, 20)), /^Previous 1 2 3 4 5 Next$/);
  assert.match(textOf(pagination(20, 20)), /^Previous 16 17 18 19 20 Next$/);
  assert.match(textOf(pagination(2, 3)), /^Previous 1 2 3 Next$/);
});

test("Pagination keeps and encodes extra query parameters in every link", () => {
  const anchors = findTags(pagination(2, 3, { q: "a&b c" }), "a");
  assert.ok(anchors.length > 0);
  for (const anchor of anchors) {
    const url = new URL(anchor.attributes.href?.replaceAll("&amp;", "&") ?? "", "http://example.test");
    assert.equal(url.searchParams.get("q"), "a&b c");
    assert.ok(url.searchParams.get("page"));
  }
});

const KATABA = "كَتَبَ";
const IMPERATIVE_PERSONS = [
  ["second_person_masculine_singular", "اُكْتُبْ"],
  ["second_person_feminine_singular", "اُكْتُبِي"],
  ["second_person_dual", "اُكْتُبَا"],
  ["second_person_masculine_plural", "اُكْتُبُوا"],
  ["second_person_feminine_plural", "اُكْتُبْنَ"],
] as const;
const PERFECT_PERSONS = [
  ["first_person_singular", "كَتَبْتُ"],
  ["second_person_masculine_singular", "كَتَبْتَ"],
  ["second_person_feminine_singular", "كَتَبْتِ"],
  ["third_person_masculine_singular", "كَتَبَ"],
  ["third_person_feminine_singular", "كَتَبَتْ"],
  ["second_person_dual", "كَتَبْتُمَا"],
  ["third_person_masculine_dual", "كَتَبَا"],
  ["third_person_feminine_dual", "كَتَبَتَا"],
  ["first_person_plural", "كَتَبْنَا"],
  ["second_person_masculine_plural", "كَتَبْتُمْ"],
  ["second_person_feminine_plural", "كَتَبْتُنَّ"],
  ["third_person_masculine_plural", "كَتَبُوا"],
  ["third_person_feminine_plural", "كَتَبْنَ"],
] as const;

const conjugationsFor = (entryId: number) => [
  ...PERFECT_PERSONS.map(([person, form], index) => makeConjugation(entryId, index + 1, "perfect", person, form)),
  ...IMPERATIVE_PERSONS.map(([person, form], index) =>
    makeConjugation(entryId, 100 + index, "imperative", person, form),
  ),
];

const conjugationTable = (word: string, overrides: Partial<Parameters<typeof ConjugationTable>[0]> = {}) =>
  createElement(ConjugationTable, {
    word,
    patternFormNumber: 1,
    patternDescription: "a ~ u",
    masdar: "كِتَابَة",
    activeParticiple: "كَاتِب",
    passiveParticiple: "مَكْتُوب",
    conjugations: conjugationsFor(1),
    ...overrides,
  });

test("ConjugationTable gives each scroll region a name that includes its own word", () => {
  const html = renderMarkup(
    createElement(
      Fragment,
      null,
      conjugationTable("كَتَبَ"),
      conjugationTable("قَرَأَ", { conjugations: conjugationsFor(2) }),
    ),
  );
  const regions = findTags(html, "div").filter((div) => div.attributes.role === "region");
  assert.deepEqual(
    regions.map((region) => region.attributes["aria-label"]),
    ["Active voice conjugation of كَتَبَ", "Active voice conjugation of قَرَأَ"],
  );
  assert.ok(regions.every((region) => region.attributes.tabindex === "0"));
});

test("ConjugationTable labels the grid by a heading id that is unique per table", () => {
  const html = renderMarkup(createElement(Fragment, null, conjugationTable("كَتَبَ"), conjugationTable("قَرَأَ")));
  const grids = findTags(html, "table").filter((table) => table.attributes["aria-labelledby"]);
  assert.equal(grids.length, 2);
  const labelIds = grids.map((grid) => grid.attributes["aria-labelledby"] ?? "");
  assert.equal(new Set(labelIds).size, 2);
  for (const labelId of labelIds) {
    assert.equal(findTags(html, "div").filter((div) => div.attributes.id === labelId).length, 1);
  }
});

test("ConjugationTable header cells all carry a scope and none is empty", () => {
  const html = renderMarkup(conjugationTable("كَتَبَ"));
  const headerCells = [...html.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)];
  assert.ok(headerCells.length > 10);
  for (const [, attributes, content] of headerCells) {
    assert.match(attributes ?? "", /scope="(row|col|colgroup)"/);
    assert.notEqual(textOf(content ?? ""), "");
  }
  const scopes = new Set(headerCells.map(([, attributes]) => /scope="(\w+)"/.exec(attributes ?? "")?.[1]));
  assert.deepEqual([...scopes].sort(), ["col", "colgroup", "row"]);
  assert.equal(findTags(html, "td").filter((cell) => cell.attributes["aria-hidden"] === "true").length > 0, true);
});

test("ConjugationTable wraps every Arabic string in an element with lang=ar", () => {
  const html = renderMarkup(conjugationTable("كَتَبَ"));
  assert.equal(ARABIC.test(textOf(stripLangArabicSpans(html))), false);
  for (const [, form] of [...PERFECT_PERSONS, ...IMPERATIVE_PERSONS]) {
    assert.ok(html.includes(`<span lang="ar">${form}</span>`), form);
  }
  for (const form of ["كِتَابَة", "كَاتِب", "مَكْتُوب"]) {
    assert.ok(html.includes(`<span lang="ar">${form}</span>`), form);
  }
});

test("ConjugationTable only renders the moods and principal parts it has data for", () => {
  const html = renderMarkup(conjugationTable("كَتَبَ", { masdar: null, activeParticiple: null }));
  const text = textOf(html);
  assert.ok(text.includes("past (perfect) indicative"));
  assert.ok(text.includes("imperative"));
  assert.equal(text.includes("subjunctive"), false);
  assert.equal(text.includes("jussive"), false);
  assert.equal(text.includes("verbal noun"), false);
  assert.equal(text.includes("active participle"), false);
  assert.ok(text.includes("passive participle"));
});

test("ConjugationTable emphasises with em, links the form to the appendix section and keeps passive rows out of the active block", () => {
  const html = renderMarkup(
    conjugationTable("كَتَبَ", {
      conjugations: [
        ...conjugationsFor(1),
        {
          id: 900,
          lexicalEntryId: 1,
          voice: "passive",
          mood: "perfect",
          person: "first_person_singular",
          form: "كُتِبْتُ",
        },
      ],
    }),
  );
  assert.equal(findTags(html, "i").length, 0);
  assert.ok(html.includes("<em>active voice</em>"));
  assert.equal(html.split("<em>passive voice</em>")[0]?.includes("كُتِبْتُ"), false);
  const appendixLink = findTags(html, "a").find((anchor) => anchor.attributes.href?.startsWith("/appendix/"));
  assert.equal(appendixLink?.attributes.href, "/appendix/arabic-verbs#Form_I");
});

const book = makeEntry({
  id: 7,
  language: "en",
  text: "book",
  normalizedText: "book",
  slug: "book",
  morphologyOverrides: { no_passive: false, plural_form: "books" },
  senses: [
    makeSense({
      id: 11,
      lexicalEntryId: 7,
      pos: "noun",
      definitions: ["a bound set of pages"],
      translations: [
        {
          senseId: 11,
          targetSenseId: 21,
          targetText: "كِتَاب",
          targetNormalizedText: "كتاب",
          targetSlug: "كتاب",
          domain: "general",
          note: null,
          frequencyRank: 1,
        },
      ],
      relatedSenses: [
        {
          senseId: 11,
          targetSenseId: 31,
          targetText: "volume book",
          targetNormalizedText: "volumebook",
          targetSlug: "volume-book",
          relationType: "near_synonym",
          contextNote: null,
          strength: null,
        },
      ],
    }),
    makeSense({ id: 12, lexicalEntryId: 7, senseNumber: 2, pos: "verb", definitions: ["to reserve"] }),
  ],
});

const kitab = makeEntry({
  id: 8,
  text: "كِتَاب",
  normalizedText: "كتاب",
  slug: "كتاب",
  morphologyOverrides: { no_passive: false, dual_form: "كِتَابَانِ", plural_form: "كُتُب", elative_form: "أَكْتَب" },
  senses: [makeSense({ id: 21, lexicalEntryId: 8, pos: "noun", definitions: ["book"] })],
});

test("sense elements get stable sense-<id> anchors and no legacy entry-n-sense-n ids", () => {
  const html = renderMarkup(createElement(SenseList, { senses: book.senses, language: "en" }));
  const ids = findTags(html, "div")
    .map((div) => div.attributes.id)
    .filter(Boolean);
  assert.deepEqual(ids, ["sense-11", "sense-12"]);
  assert.equal(html.includes("-sense-"), false);
});

test("related and translation links point at sense anchors that exist on the target page", () => {
  const source = renderMarkup(createElement(SenseList, { senses: book.senses, language: "en" }));
  const target = renderMarkup(createElement(SenseList, { senses: kitab.senses, language: "ar" }));
  const hrefs = findTags(source, "a").map((anchor) => anchor.attributes.href);
  assert.deepEqual(hrefs, ["/entry/volume-book#sense-31", "/entry/%D9%83%D8%AA%D8%A7%D8%A8#sense-21"]);
  const translationAnchor = hrefs[1]?.split("#")[1];
  assert.ok(target.includes(`id="${translationAnchor}"`));
});

test("link text is marked with the language of the target, not of the page", () => {
  const html = renderMarkup(createElement(SenseList, { senses: book.senses, language: "en" }));
  assert.ok(html.includes('<span lang="ar">كِتَاب</span>'));
  assert.ok(html.includes('<span lang="en">volume book</span>'));
});

test("EntryHeader renders a level one heading only for the primary entry and anchors it by id", () => {
  const primary = renderMarkup(createElement(EntryHeader, { entry: book, isPrimary: true }));
  const secondary = renderMarkup(createElement(EntryHeader, { entry: kitab }));
  assert.equal(findTags(primary, "h1").length, 1);
  assert.equal(findTags(primary, "h2").length, 0);
  assert.equal(findTags(secondary, "h2").length, 1);
  assert.equal(findTags(secondary, "h1").length, 0);
  assert.equal(findTags(primary, "div")[0]?.attributes.id, "entry-7");
  assert.ok(primary.includes('<span lang="en">book</span>'));
  assert.ok(secondary.includes('<span lang="ar">كِتَاب</span>'));
});

test("EntryHeader marks extra forms with the script they are written in", () => {
  const english = renderMarkup(createElement(EntryHeader, { entry: book }));
  assert.ok(english.includes('plural: <span lang="en">books</span>'));
  const arabic = renderMarkup(createElement(EntryHeader, { entry: kitab }));
  assert.ok(arabic.includes('dual: <span lang="ar">كِتَابَانِ</span>'));
  assert.ok(arabic.includes('plural: <span lang="ar">كُتُب</span>'));
  assert.equal(arabic.includes("elative"), false);
});

test("EntryHeader only shows extra forms that fit the part of speech of its senses", () => {
  const verbOnly = makeEntry({
    ...book,
    senses: [makeSense({ id: 12, lexicalEntryId: 7, pos: "verb" })],
  });
  assert.equal(renderMarkup(createElement(EntryHeader, { entry: verbOnly })).includes("plural"), false);
  const adjective = makeEntry({
    ...kitab,
    senses: [makeSense({ id: 22, lexicalEntryId: 8, pos: "adjective" })],
  });
  const html = renderMarkup(createElement(EntryHeader, { entry: adjective }));
  assert.ok(html.includes('elative: <span lang="ar">أَكْتَب</span>'));
  assert.equal(html.includes("plural"), false);
});

test("EntryDetail renders the conjugation table only for entries with a morphological pattern", () => {
  const plain = renderMarkup(createElement(EntryDetail, { entry: kitab, language: "ar", isPrimary: true }));
  assert.equal(findTags(plain, "table").length, 0);
  const verb = makeEntry({
    id: 1,
    text: KATABA,
    normalizedText: "كتب",
    slug: "كتب",
    morphPattern: { formNumber: 1, description: "a ~ u" },
    senses: [makeSense({ id: 1, lexicalEntryId: 1, pos: "verb", definitions: ["to write"] })],
    conjugations: conjugationsFor(1),
    masdar: "كِتَابَة",
  });
  const html = renderMarkup(createElement(EntryDetail, { entry: verb, language: "ar", isPrimary: true }));
  assert.equal(findTags(html, "table").length, 2);
  assert.ok(html.includes(`aria-label="Active voice conjugation of ${KATABA}"`));
  assert.ok(html.includes('id="sense-1"'));
  assert.ok(html.includes('id="entry-1"'));
});

test("EntryDetail hands the alternative forms, the alternative verbal nouns and the passive alternatives of the entry to its table", () => {
  const verb = makeEntry({
    id: 1,
    text: KATABA,
    normalizedText: "كتب",
    slug: "كتب",
    morphPattern: { formNumber: 1, description: "a ~ u" },
    senses: [makeSense({ id: 1, lexicalEntryId: 1, pos: "verb", definitions: ["to write"] })],
    conjugations: [
      ...conjugationsFor(1),
      { ...makeConjugation(1, 300, "imperfect_jussive", "third_person_masculine_singular", "يُكْتَبْ"), voice: "passive" },
    ],
    masdar: "كِتَابَة",
    alternatives: { imperative: { second_person_masculine_singular: ["اُكْتُبِ"] } },
    passiveAlternatives: { imperfect_jussive: { third_person_masculine_singular: ["يُكْتَبِ"] } },
    alternativeNouns: { masdar: ["كَتْب"] },
  });
  const html = renderMarkup(createElement(EntryDetail, { entry: verb, language: "ar", isPrimary: true }));
  const lists = findTags(html, "ul").filter((tag) => tag.attributes["aria-label"] === "Alternative forms");
  assert.equal(lists.length, 3);
  assert.ok(html.includes('<span lang="ar">يُكْتَبِ</span>'));
  assert.ok(html.includes('<span lang="ar">اُكْتُبِ</span>'));
  assert.ok(html.includes('<span lang="ar">كَتْب</span>'));
  const plain = renderMarkup(
    createElement(EntryDetail, {
      entry: { ...verb, alternatives: undefined, passiveAlternatives: undefined, alternativeNouns: undefined },
      language: "ar",
    }),
  );
  assert.equal(findTags(plain, "ul").filter((tag) => tag.attributes["aria-label"] === "Alternative forms").length, 0);
});

test("the search combobox starts collapsed with complete ARIA wiring", () => {
  const html = renderMarkup(createElement(EntrySearchForm));
  const [input] = findTags(html, "input");
  assert.ok(input);
  assert.equal(input.attributes.role, "combobox");
  assert.equal(input.attributes["aria-expanded"], "false");
  assert.equal(input.attributes["aria-autocomplete"], "list");
  assert.equal(input.attributes["aria-label"], "Search Dictionary");
  assert.equal(input.attributes.type, "search");
  assert.equal(input.attributes.autoComplete, "off");
  assert.equal(input.attributes.dir, "auto");
  assert.equal(input.attributes.name, "q");
  assert.equal("aria-controls" in input.attributes, false);
  assert.equal("aria-activedescendant" in input.attributes, false);
});

test("the search form works without scripts and exposes a polite status region but no listbox yet", () => {
  const html = renderMarkup(createElement(EntrySearchForm));
  const [form] = findTags(html, "form");
  assert.equal(form?.attributes.action, "/search");
  assert.equal(form?.attributes.method, "get");
  const [landmark] = findTags(html, "search");
  assert.equal(landmark?.attributes["aria-label"], "Site search");
  const status = findTags(html, "div").find((div) => div.attributes.role === "status");
  assert.equal(status?.attributes["aria-live"], "polite");
  assert.equal(html.includes('role="listbox"'), false);
  assert.equal(html.includes('role="option"'), false);
});

const failure = Object.assign(new Error("boom"), { digest: "abc123" });

test("the error page announces itself, offers a retry and a way home, and shows the digest", () => {
  const html = renderMarkup(createElement(ErrorPage, { error: failure, retry: () => undefined }));
  const [alert] = findTags(html, "div");
  assert.equal(alert?.attributes.role, "alert");
  assert.equal(findTags(html, "h1").length, 1);
  assert.ok(textOf(html).includes("Something went wrong"));
  assert.ok(textOf(html).includes("Reference: abc123"));
  assert.equal(findTags(html, "button")[0]?.attributes.type, "button");
  assert.equal(findTags(html, "a")[0]?.attributes.href, "/");
  assert.equal(html.includes("boom"), false);
});

test("the error page leaves out the reference when the error has no digest", () => {
  const html = renderMarkup(createElement(ErrorPage, { error: new Error("boom"), retry: () => undefined }));
  assert.equal(textOf(html).includes("Reference"), false);
});

test("the global error page is a complete document with a language, a heading and a retry button", () => {
  const html = renderMarkup(createElement(GlobalError, { error: failure, retry: () => undefined }));
  assert.equal(findTags(html, "html")[0]?.attributes.lang, "en");
  assert.equal(findTags(html, "h1").length, 1);
  assert.equal(findTags(html, "main")[0]?.attributes.role, "alert");
  assert.equal(findTags(html, "button").length, 1);
  assert.ok(textOf(html).includes("Reference: abc123"));
});
