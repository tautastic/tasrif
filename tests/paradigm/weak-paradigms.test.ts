import assert from "node:assert/strict";
import { test } from "node:test";
import { WEAK_PARADIGM_FIXTURES, type WeakParadigmFixture } from "../fixtures/weak-paradigms.ts";
import {
  assertArabicEqual,
  assertParadigmEqual,
  conjugate,
  IMPERATIVE_PERSONS,
  type Mood,
  openDatabase,
  PERSONS,
  verbalNouns,
} from "../harness";

const db = await openDatabase();

interface ResolvedPattern {
  id: number;
  code: string;
  is_lexical: boolean;
}

const resolve = (fixture: WeakParadigmFixture): Promise<ResolvedPattern | null> =>
  db.maybeOne<ResolvedPattern>(
    `SELECT mp.id, mp.code, mp.is_lexical
     FROM morph_pattern mp
     WHERE mp.id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)`,
    [fixture.root, fixture.formNumber, fixture.perfectVowel, fixture.imperfectVowel],
  );

const requirePattern = async (fixture: WeakParadigmFixture): Promise<ResolvedPattern> => {
  const resolved = await resolve(fixture);
  assert.ok(
    resolved,
    `${fixture.root} form ${fixture.formNumber} ${fixture.perfectVowel ?? ""} ~ ${fixture.imperfectVowel ?? ""} resolves to no pattern\n${fixture.source}`,
  );
  return resolved;
};

const MOOD_CELLS: [Mood, (fixture: WeakParadigmFixture) => Record<string, string>, number][] = [
  ["perfect", (fixture) => fixture.perfect, PERSONS.length],
  ["imperfect_indicative", (fixture) => fixture.imperfectIndicative, PERSONS.length],
  ["imperfect_subjunctive", (fixture) => fixture.imperfectSubjunctive, PERSONS.length],
  ["imperfect_jussive", (fixture) => fixture.imperfectJussive, PERSONS.length],
  ["imperative", (fixture) => fixture.imperative, IMPERATIVE_PERSONS.length],
];

const fixtureStrings = (fixture: WeakParadigmFixture): string[] => [
  fixture.root,
  fixture.citationForm,
  ...MOOD_CELLS.flatMap(([, cells]) => Object.values(cells(fixture))),
  ...[fixture.masdar, fixture.activeParticiple, fixture.passiveParticiple].filter(
    (value): value is string => value !== null,
  ),
];

test("every weak paradigm fixture is written in NFC with a complete set of persons", () => {
  for (const fixture of WEAK_PARADIGM_FIXTURES) {
    for (const value of fixtureStrings(fixture)) {
      assert.equal(value, value.normalize("NFC"), `${fixture.id}: ${value} is not NFC`);
      assert.ok(value.length > 0, `${fixture.id} has an empty cell`);
    }
    for (const [mood, cells, expected] of MOOD_CELLS) {
      assert.equal(Object.keys(cells(fixture)).length, expected, `${fixture.id} ${mood}`);
    }
  }
});

test("weak paradigm fixture ids are unique", () => {
  const ids = WEAK_PARADIGM_FIXTURES.map((fixture) => fixture.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const fixture of WEAK_PARADIGM_FIXTURES) {
  const heading = `${fixture.id} (${fixture.citationForm}, ${fixture.gloss})`;
  const options = fixture.pending ? { skip: `pending: ${fixture.pending}` } : {};

  test(`${heading} resolves to ${fixture.patternCode ?? "no pattern"}`, options, async () => {
    const resolved = await requirePattern(fixture);
    assert.equal(resolved.code, fixture.patternCode, `${heading}\n${fixture.source}`);
    assert.equal(resolved.is_lexical, fixture.lexical, `${heading} lexical flag`);
  });

  test(`finite paradigm of ${heading}`, options, async () => {
    const resolved = await requirePattern(fixture);
    const paradigm = await conjugate(db, fixture.root, resolved.id);
    for (const [mood, cells, expected] of MOOD_CELLS) {
      const actual = paradigm[mood] ?? {};
      assert.equal(Object.keys(actual).length, expected, `${heading} ${mood} cell count`);
      assertParadigmEqual(actual, cells(fixture), `${heading} ${mood}\n${fixture.source}`);
    }
  });

  test(`verbal nouns of ${heading}`, options, async () => {
    const resolved = await requirePattern(fixture);
    const nouns = await verbalNouns(db, fixture.root, resolved.id);
    const deviations = fixture.engineDeviations ?? {};
    const expected = (key: "masdar" | "activeParticiple" | "passiveParticiple"): string | null =>
      key in deviations ? (deviations[key] ?? null) : fixture[key];
    assertArabicEqual(nouns.masdar, expected("masdar"), `${heading} masdar\n${fixture.source}`);
    assertArabicEqual(
      nouns.active_participle,
      expected("activeParticiple"),
      `${heading} active participle\n${fixture.source}`,
    );
    assertArabicEqual(
      nouns.passive_participle,
      expected("passiveParticiple"),
      `${heading} passive participle\n${fixture.source}`,
    );
  });
}
