import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSIVE_PARADIGM_FIXTURES, type PassiveParadigmFixture } from "../fixtures/passive-paradigms.ts";
import { assertParadigmEqual, type Mood, openDatabase, PERSONS } from "../harness";
import { passiveParadigm } from "./passive-harness.ts";

const db = await openDatabase();

interface ResolvedPattern {
  id: number;
  code: string;
  is_lexical: boolean;
}

const resolve = (fixture: PassiveParadigmFixture): Promise<ResolvedPattern | null> =>
  db.maybeOne<ResolvedPattern>(
    `SELECT mp.id, mp.code, mp.is_lexical
     FROM morph_pattern mp
     WHERE mp.id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int)`,
    [fixture.root, fixture.formNumber, fixture.perfectVowel, fixture.imperfectVowel, fixture.radicalCount ?? 3],
  );

const MOOD_CELLS: [Mood, (fixture: PassiveParadigmFixture) => Record<string, string>][] = [
  ["perfect", (fixture) => fixture.perfect],
  ["imperfect_indicative", (fixture) => fixture.imperfectIndicative],
  ["imperfect_subjunctive", (fixture) => fixture.imperfectSubjunctive],
  ["imperfect_jussive", (fixture) => fixture.imperfectJussive],
];

test("passive fixture ids are unique and every cell is complete NFC text", () => {
  const ids = PASSIVE_PARADIGM_FIXTURES.map((fixture) => fixture.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const fixture of PASSIVE_PARADIGM_FIXTURES) {
    for (const [mood, cells] of MOOD_CELLS) {
      const values = Object.values(cells(fixture));
      assert.equal(values.length, PERSONS.length, `${fixture.id} ${mood}`);
      for (const value of values) {
        assert.equal(value, value.normalize("NFC"), `${fixture.id}: ${value} is not NFC`);
        assert.ok(value.length > 0, `${fixture.id} ${mood} has an empty cell`);
      }
    }
  }
});

for (const fixture of PASSIVE_PARADIGM_FIXTURES) {
  const heading = `${fixture.id} (${fixture.citationForm}, ${fixture.gloss})`;

  test(`${heading} resolves to ${fixture.patternCode}`, async () => {
    const resolved = await resolve(fixture);
    assert.ok(resolved, `${heading} resolves to no pattern\n${fixture.source}`);
    assert.equal(resolved.code, fixture.patternCode, `${heading}\n${fixture.source}`);
    assert.equal(resolved.is_lexical, fixture.lexical, `${heading} lexical flag`);
  });

  test(`passive paradigm of ${heading}`, async () => {
    const resolved = await resolve(fixture);
    assert.ok(resolved, `${heading} resolves to no pattern`);
    const paradigm = await passiveParadigm(db, fixture.root, resolved.id);
    assert.deepEqual(Object.keys(paradigm).sort(), MOOD_CELLS.map(([mood]) => mood).sort(), `${heading} moods`);
    for (const [mood, cells] of MOOD_CELLS) {
      const actual = paradigm[mood] ?? {};
      assert.equal(Object.keys(actual).length, PERSONS.length, `${heading} ${mood} cell count`);
      assertParadigmEqual(actual, cells(fixture), `${heading} ${mood}\n${fixture.source}`);
    }
  });
}
