import assert from "node:assert/strict";
import { test } from "node:test";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";

const { sql, entries, patterns, overrides } = await openRepository();

const sitemap = await import("~/server/db/repository/lexical-entry/sitemap");
const { searchSenses, getSensesByIds } = await import("~/server/db/repository/sense");

const verbPattern = await patterns.resolveVerbMorphPattern("كتب", "form-1-a-u");
assert.ok(verbPattern);

const verified = await insertEntryWithSense(sql, { language: "ar", text: "كِتَاب", root: "كتب" });
const sameSlug = await insertEntryWithSense(sql, { language: "ar", text: "كُتَّاب", root: "كتب" });
const duplicateSlug = await insertEntryWithSense(sql, { language: "en", text: "Kitab" });
const secondSlug = await insertEntryWithSense(sql, { language: "en", text: "kitab " });
const draft = await insertEntryWithSense(sql, { language: "ar", text: "مسودة", root: "سود", isVerified: false });
await sql.exec(
  "INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified) VALUES ('ar', 'كَتَبَ', 'كتب', $1, true)",
  [verbPattern.id],
);
const verbEntryId = await sql.scalar<number>("SELECT id FROM lexical_entry WHERE text = 'كَتَبَ'");
await sql.exec(
  "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, 'verb', 1, ARRAY['to write'])",
  [verbEntryId],
);

test("the sitemap lists each verified slug once, in order, and pages through them", async () => {
  const total = await sitemap.countSitemapEntrySlugs();
  const all = await sitemap.getSitemapEntrySlugs({ offset: 0, limit: 100 });
  assert.equal(all.length, total);
  assert.deepEqual(all, [...all].sort());
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.includes("مسودة"), false);
  assert.equal(all.filter((slug) => slug === "kitab").length, 1);

  const paged: string[] = [];
  for (let offset = 0; offset < total; offset += 2) {
    paged.push(...(await sitemap.getSitemapEntrySlugs({ offset, limit: 2 })));
  }
  assert.deepEqual(paged, all);
  assert.deepEqual(await sitemap.getSitemapEntrySlugs({ offset: total, limit: 5 }), []);
});

test("the admin entry page loads senses, pattern and the count of verified entries sharing the root", async () => {
  const found = await entries.getLexicalEntryByIdForAdmin(verbEntryId);
  assert.ok(found);
  assert.equal(found.language, "ar");
  assert.equal(found.entry.morphPattern?.formNumber, 1);
  assert.equal(found.entry.senses[0]?.pos, "verb");
  assert.ok(found.entry.conjugations.length > 0);
  assert.deepEqual(found.rootInfo.arabic, "كتب");
  assert.equal(found.rootInfo.count, 3);
  assert.equal(await entries.getLexicalEntryByIdForAdmin(987654), null);

  const draftPage = await entries.getLexicalEntryByIdForAdmin(draft.entryId);
  assert.equal(draftPage?.entry.isVerified, false);
  assert.equal(draftPage?.rootInfo.count, 0);
});

test("the root count is zero without a root", async () => {
  const english = await entries.getLexicalEntryByIdForAdmin(duplicateSlug.entryId);
  assert.equal(english?.rootInfo.count, 0);
  assert.equal(await entries.countEntriesWithRoot(null), 0);
  assert.equal(await entries.countEntriesWithRoot("كتب"), 3);
});

test("the public entry page groups entries that share a slug and hides unverified ones", async () => {
  const kitab = await entries.getLexicalEntryBySlug("kitab");
  assert.deepEqual(
    kitab?.entries.map((entry) => entry.id),
    [duplicateSlug.entryId, secondSlug.entryId].sort((a, b) => a - b),
  );
  assert.equal(await entries.getLexicalEntryBySlug("مسودة"), null);
  assert.equal(await entries.getLexicalEntryBySlug("does-not-exist"), null);
  const arabic = await entries.getLexicalEntryBySlug("كتاب");
  assert.equal(arabic?.rootInfo.count, 3);
  assert.deepEqual(
    arabic?.entries.map((entry) => entry.id),
    [verified.entryId, sameSlug.entryId].sort((a, b) => a - b),
  );
});

test("the entry summary returns only the text and language", async () => {
  assert.deepEqual(await entries.getLexicalEntrySummary(verified.entryId), { text: "كِتَاب", language: "ar" });
  assert.equal(await entries.getLexicalEntrySummary(987654), undefined);
});

test("editing an entry that does not exist returns nothing", async () => {
  assert.equal(await entries.getLexicalEntryForEdit(987654), undefined);
});

test("the admin pattern list filters by form and by lexical flag and pages without losing the total", async () => {
  const all = await patterns.listMorphPatternsForAdmin({ lexicalFilter: "All", page: 1, limit: 1000 });
  assert.equal(all.items.length, all.total);
  assert.ok(all.total > 20);
  assert.deepEqual(
    all.items.map((item) => [item.formNumber, item.id]),
    [...all.items].sort((a, b) => a.formNumber - b.formNumber || a.id - b.id).map((item) => [item.formNumber, item.id]),
  );

  const formOne = await patterns.listMorphPatternsForAdmin({
    formNumber: 1,
    lexicalFilter: "All",
    page: 1,
    limit: 1000,
  });
  assert.ok(formOne.items.every((item) => item.formNumber === 1));
  assert.equal(formOne.total, all.items.filter((item) => item.formNumber === 1).length);

  const lexical = await patterns.listMorphPatternsForAdmin({ lexicalFilter: "Lexical", page: 1, limit: 1000 });
  const shape = await patterns.listMorphPatternsForAdmin({ lexicalFilter: "Shape-resolved", page: 1, limit: 1000 });
  assert.ok(lexical.items.every((item) => item.isLexical));
  assert.ok(shape.items.every((item) => !item.isLexical));
  assert.equal(lexical.total + shape.total, all.total);

  const seen: number[] = [];
  for (let page = 1; page <= Math.ceil(all.total / 7); page++) {
    seen.push(
      ...(await patterns.listMorphPatternsForAdmin({ lexicalFilter: "All", page, limit: 7 })).items.map(
        (item) => item.id,
      ),
    );
  }
  assert.deepEqual(
    seen,
    all.items.map((item) => item.id),
  );
});

test("pattern usage counts include entries and overrides", async () => {
  assert.deepEqual(await patterns.getMorphPatternUsageCounts(verbPattern.id), { entryCount: 1, overrideCount: 0 });
  await overrides.createOverride({
    root: "سأل",
    formNumber: 1,
    perfectVowel: "a",
    imperfectVowel: "a",
    morphPatternId: verbPattern.id,
  });
  assert.deepEqual(await patterns.getMorphPatternUsageCounts(verbPattern.id), { entryCount: 1, overrideCount: 1 });
  assert.deepEqual(await patterns.getMorphPatternUsageCounts(987654), { entryCount: 0, overrideCount: 0 });
});

test("the verb form summary counts only forms that have verified entries", async () => {
  const forms = await patterns.getVerbFormsWithCounts();
  assert.deepEqual(forms, [{ formNumber: 1, total: 1 }]);
});

test("a root is described or explained, never both", async () => {
  const sound = await patterns.describeVerbRoot("كتب");
  assert.equal(sound.rootError, null);
  assert.ok(sound.labels && sound.labels.length > 0);

  for (const bad of ["ترجم", "ك", "ab"]) {
    const result = await patterns.describeVerbRoot(bad);
    assert.equal(result.labels, null, bad);
    assert.equal(typeof result.rootError, "string", bad);
  }
});

test("an ambiguous pattern is found by its full matching key and the pattern itself can be excluded", async () => {
  const stored = await patterns.getMorphPatternById(verbPattern.id);
  assert.ok(stored);
  const key = {
    formNumber: stored.formNumber,
    radical1Kind: stored.radical1Kind,
    radical2Kind: stored.radical2Kind,
    radical3Kind: stored.radical3Kind,
    isGeminate: stored.isGeminate,
    perfectVowel: stored.perfectVowel,
    imperfectVowel: stored.imperfectVowel,
  };
  assert.equal((await patterns.findAmbiguousPattern(key))?.id, verbPattern.id);
  assert.equal(await patterns.findAmbiguousPattern(key, verbPattern.id), null);
  assert.equal(await patterns.findAmbiguousPattern({ ...key, imperfectVowel: "i", perfectVowel: "u" }), null);
  const flipped = { ...key, isGeminate: !stored.isGeminate };
  const expected = await sql.column<number>(
    `SELECT morph_pattern_id FROM morph_pattern_resolution
     WHERE form_number = $1 AND radical1_kind = $2::radical_kind AND radical2_kind = $3::radical_kind
       AND radical3_kind = $4::radical_kind AND is_geminate = $5
       AND perfect_vowel IS NOT DISTINCT FROM $6::short_vowel
       AND imperfect_vowel IS NOT DISTINCT FROM $7::short_vowel
     ORDER BY id`,
    [
      flipped.formNumber,
      flipped.radical1Kind,
      flipped.radical2Kind,
      flipped.radical3Kind,
      flipped.isGeminate,
      flipped.perfectVowel,
      flipped.imperfectVowel,
    ],
  );
  assert.equal((await patterns.findAmbiguousPattern(flipped))?.id ?? null, expected[0] ?? null);
});

test("the matching key of a quadriliteral pattern includes its fourth radical", async () => {
  const key = {
    formNumber: 3,
    radicalCount: 4,
    radical1Kind: "sound",
    radical2Kind: "sound",
    radical3Kind: "sound",
    isGeminate: false,
    perfectVowel: null,
    imperfectVowel: null,
  } as const;
  assert.equal((await patterns.findAmbiguousPattern(key))?.description, "quadriliteral");
  assert.equal((await patterns.findAmbiguousPattern({ ...key, radical4Kind: "sound" }))?.description, "quadriliteral");
  assert.equal(
    (await patterns.findAmbiguousPattern({ ...key, radical4Kind: "ya" }))?.description,
    "quadriliteral final-weak",
  );
  assert.equal(await patterns.findAmbiguousPattern({ ...key, radical4Kind: "waw" }), null);
});

test("sense search pages through matches in a stable order and reports whether more exist", async () => {
  const everything = await searchSenses({ query: "كتاب", language: "ar", limit: 50 });
  assert.ok(everything.items.length >= 2);
  assert.equal(everything.hasMore, false);
  assert.ok(everything.items.some((item) => item.id === verified.senseId));

  const first = await searchSenses({ query: "كتاب", language: "ar", limit: 1, page: 1 });
  const second = await searchSenses({ query: "كتاب", language: "ar", limit: 1, page: 2 });
  assert.deepEqual(first.items, everything.items.slice(0, 1));
  assert.deepEqual(second.items, everything.items.slice(1, 2));
  assert.equal(first.hasMore, true);

  assert.deepEqual(await searchSenses({ query: "   ", limit: 5 }), { items: [], hasMore: false });
  assert.deepEqual(await getSensesByIds([]), []);
  const byIds = await getSensesByIds([verified.senseId, 987654]);
  assert.deepEqual(byIds, [{ id: verified.senseId, text: "كِتَاب", pos: "noun", language: "ar" }]);
});
