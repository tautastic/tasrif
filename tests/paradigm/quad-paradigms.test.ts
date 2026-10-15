import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVerbFormChoice } from "~/lib/validation/verbFormChoice";
import { QUAD_PARADIGM_FIXTURES, type QuadParadigmFixture } from "../fixtures/quad-paradigms.ts";
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

const resolve = (fixture: QuadParadigmFixture): Promise<ResolvedPattern | null> => {
  const { formNumber, perfectVowel, imperfectVowel, radicalCount } = resolveVerbFormChoice(fixture.choice);
  return db.maybeOne<ResolvedPattern>(
    `SELECT mp.id, mp.code, mp.is_lexical
     FROM morph_pattern mp
     WHERE mp.id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int)`,
    [fixture.root, formNumber, perfectVowel, imperfectVowel, radicalCount],
  );
};

const requirePattern = async (fixture: QuadParadigmFixture): Promise<ResolvedPattern> => {
  const resolved = await resolve(fixture);
  assert.ok(resolved, `${fixture.root} ${fixture.choice} resolves to no pattern\n${fixture.source}`);
  return resolved;
};

const MOOD_CELLS: [Mood, (fixture: QuadParadigmFixture) => Record<string, string>, number][] = [
  ["perfect", (fixture) => fixture.perfect, PERSONS.length],
  ["imperfect_indicative", (fixture) => fixture.imperfectIndicative, PERSONS.length],
  ["imperfect_subjunctive", (fixture) => fixture.imperfectSubjunctive, PERSONS.length],
  ["imperfect_jussive", (fixture) => fixture.imperfectJussive, PERSONS.length],
  ["imperative", (fixture) => fixture.imperative, IMPERATIVE_PERSONS.length],
];

const fixtureStrings = (fixture: QuadParadigmFixture): string[] => [
  fixture.root,
  fixture.citationForm,
  ...MOOD_CELLS.flatMap(([, cells]) => Object.values(cells(fixture))),
  fixture.masdar,
  fixture.activeParticiple,
  ...(fixture.passiveParticiple === null ? [] : [fixture.passiveParticiple]),
];

test("every quadriliteral fixture is written in NFC with a complete set of persons", () => {
  for (const fixture of QUAD_PARADIGM_FIXTURES) {
    assert.equal(Array.from(fixture.root).length, 4, `${fixture.id} root`);
    for (const value of fixtureStrings(fixture)) {
      assert.equal(value, value.normalize("NFC"), `${fixture.id}: ${value} is not NFC`);
      assert.ok(value.length > 0, `${fixture.id} has an empty cell`);
    }
    for (const [mood, cells, expected] of MOOD_CELLS) {
      assert.equal(Object.keys(cells(fixture)).length, expected, `${fixture.id} ${mood}`);
    }
  }
});

test("quadriliteral fixture ids are unique and cover every quadriliteral form", () => {
  const ids = QUAD_PARADIGM_FIXTURES.map((fixture) => fixture.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const choice of ["form-1q", "form-2q", "form-3q", "form-4q"]) {
    assert.ok(
      QUAD_PARADIGM_FIXTURES.some((fixture) => fixture.choice === choice),
      `${choice} has no fixture`,
    );
  }
});

for (const fixture of QUAD_PARADIGM_FIXTURES) {
  const heading = `${fixture.id} (${fixture.citationForm}, ${fixture.gloss})`;

  test(`${heading} resolves to ${fixture.patternCode}`, async () => {
    const resolved = await requirePattern(fixture);
    assert.equal(resolved.code, fixture.patternCode, `${heading}\n${fixture.source}`);
    assert.equal(resolved.is_lexical, false, `${heading} lexical flag`);
  });

  test(`finite paradigm of ${heading}`, async () => {
    const resolved = await requirePattern(fixture);
    const paradigm = await conjugate(db, fixture.root, resolved.id);
    for (const [mood, cells, expected] of MOOD_CELLS) {
      const actual = paradigm[mood] ?? {};
      assert.equal(Object.keys(actual).length, expected, `${heading} ${mood} cell count`);
      assertParadigmEqual(actual, cells(fixture), `${heading} ${mood}\n${fixture.source}`);
    }
  });

  test(`verbal nouns of ${heading}`, async () => {
    const resolved = await requirePattern(fixture);
    const nouns = await verbalNouns(db, fixture.root, resolved.id);
    assertArabicEqual(nouns.masdar, fixture.masdar, `${heading} masdar\n${fixture.source}`);
    assertArabicEqual(nouns.active_participle, fixture.activeParticiple, `${heading} active participle`);
    if (fixture.passiveParticiple !== null) {
      assertArabicEqual(nouns.passive_participle, fixture.passiveParticiple, `${heading} passive participle`);
    }
  });
}
