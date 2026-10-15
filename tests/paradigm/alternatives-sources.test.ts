import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRINTED_ALTERNATIVES_FIXTURES,
  PRINTED_NOUN_ALTERNATIVES_FIXTURES,
  type PrintedAlternativesFixture,
} from "../fixtures/alternatives-cells.ts";
import { QUAD_PARADIGM_FIXTURES } from "../fixtures/quad-paradigms.ts";
import { WEAK_PARADIGM_FIXTURES } from "../fixtures/weak-paradigms.ts";
import { assertArabicEqual, type Db, insertEntry, openDatabase, type Person, storedParadigm } from "../harness";

const db = await openDatabase();

interface AlternativeRow {
  lexical_entry_id: number;
  voice: string;
  mood: string;
  person: string;
  ordinal: number;
  form: string;
}

interface NounRow {
  lexical_entry_id: number;
  noun: string;
  ordinal: number;
  form: string;
}

const resolvePattern = (fixture: {
  root: string;
  formNumber: number;
  radicalCount?: 3 | 4;
  perfectVowel: string | null;
  imperfectVowel: string | null;
}) =>
  db.scalar<number | null>("SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int)", [
    fixture.root,
    fixture.formNumber,
    fixture.perfectVowel,
    fixture.imperfectVowel,
    fixture.radicalCount ?? 3,
  ]);

const patternOfCode = (code: string) => db.scalar<number>("SELECT morph_pattern_id_for_code($1)", [code]);

const alternativesOf = (scope: Db, entryIds: number[]) =>
  scope.rows<AlternativeRow>(
    `SELECT lexical_entry_id, voice::text, mood::text, person::text, ordinal, form
     FROM entry_alternative_forms($1::int[])
     ORDER BY lexical_entry_id, voice, mood, person, ordinal`,
    [`{${entryIds.join(",")}}`],
  );

const nounsOf = (scope: Db, entryIds: number[]) =>
  scope.rows<NounRow>(
    `SELECT lexical_entry_id, noun::text, ordinal, form
     FROM entry_alternative_nouns($1::int[])
     ORDER BY lexical_entry_id, noun, ordinal`,
    [`{${entryIds.join(",")}}`],
  );

const cellKey = (voice: string | undefined, mood: string, person: string) => `${voice ?? "active"}/${mood}/${person}`;

const storedForm = (scope: Db, entryId: number, cell: { voice?: string; mood: string; person: string }) =>
  scope
    .maybeOne<{ form: string }>(
      `SELECT form FROM conjugation
       WHERE lexical_entry_id = $1 AND voice = $2::voice_type AND mood = $3::affix_mood AND person = $4::person_type`,
      [entryId, cell.voice ?? "active", cell.mood, cell.person],
    )
    .then((row) => row?.form);

test("the printed alternatives are written in NFC and every one of them differs from the others of its cell", () => {
  for (const fixture of PRINTED_ALTERNATIVES_FIXTURES) {
    for (const cell of fixture.cells) {
      assert.ok(cell.forms.length > 1, `${fixture.id} ${cellKey(cell.voice, cell.mood, cell.person)} prints one form`);
      assert.equal(new Set(cell.forms).size, cell.forms.length, `${fixture.id} repeats a form`);
      for (const form of cell.forms) {
        assert.equal(form, form.normalize("NFC"), `${fixture.id}: ${form} is not NFC`);
      }
    }
  }
});

test("every printed alternative of a shipped cell is produced after the primary form, in the order of the table", async () => {
  await db.tx(async (tx) => {
    const entries = new Map<string, { id: number; fixture: PrintedAlternativesFixture }>();
    for (const fixture of PRINTED_ALTERNATIVES_FIXTURES) {
      const patternId = await resolvePattern(fixture);
      assert.ok(patternId, `${fixture.id} resolves to no pattern`);
      const id = await insertEntry(tx, {
        text: fixture.id,
        root: fixture.root,
        morphPatternId: patternId,
        ...(fixture.noPassive ? { overrides: { no_passive: true } } : {}),
      });
      entries.set(fixture.id, { id, fixture });
    }

    const rows = await alternativesOf(
      tx,
      [...entries.values()].map((entry) => entry.id),
    );

    for (const { id, fixture } of entries.values()) {
      const produced = new Map<string, string[]>();
      for (const row of rows.filter((candidate) => candidate.lexical_entry_id === id)) {
        const key = cellKey(row.voice, row.mood, row.person);
        produced.set(key, [...(produced.get(key) ?? []), row.form]);
      }

      const expectedCells = new Set<string>();
      for (const cell of fixture.cells) {
        const key = cellKey(cell.voice, cell.mood, cell.person);
        const primary = await storedForm(tx, id, cell);
        assert.ok(primary !== undefined, `${fixture.id} ${key} has no primary form`);
        assert.ok(
          cell.forms.includes(primary),
          `${fixture.id} ${key}: the primary ${primary} is not among the printed ${cell.forms.join(" / ")}\n${fixture.source}`,
        );
        if (cell.shipped === false) {
          assert.equal(produced.get(key), undefined, `${fixture.id} ${key} ships an alternative that is withheld`);
          continue;
        }
        expectedCells.add(key);
        const expected = cell.forms.filter((form) => form !== primary);
        assert.deepEqual(produced.get(key) ?? [], expected, `${fixture.id} ${key}\n${fixture.source}`);
        for (const [index, form] of expected.entries()) {
          assertArabicEqual(produced.get(key)?.[index] ?? null, form, `${fixture.id} ${key}`);
        }
      }

      for (const key of produced.keys()) {
        assert.ok(
          expectedCells.has(key),
          `${fixture.id} produces alternatives in ${key}, which the table does not print`,
        );
      }
    }
  });
});

test("an entry of any other sourced paradigm gets no alternative", async () => {
  const covered = new Set(PRINTED_ALTERNATIVES_FIXTURES.map((fixture) => fixture.id));
  await db.tx(async (tx) => {
    const ids: number[] = [];
    for (const fixture of WEAK_PARADIGM_FIXTURES) {
      if (covered.has(fixture.id)) {
        continue;
      }
      const patternId = await resolvePattern(fixture);
      if (patternId === null) {
        continue;
      }
      ids.push(await insertEntry(tx, { text: fixture.id, root: fixture.root, morphPatternId: patternId }));
    }
    for (const fixture of QUAD_PARADIGM_FIXTURES) {
      if (covered.has(fixture.id)) {
        continue;
      }
      const patternId = await patternOfCode(fixture.patternCode);
      ids.push(await insertEntry(tx, { text: fixture.id, root: fixture.root, morphPatternId: patternId }));
    }
    assert.ok(ids.length > 200);
    assert.deepEqual(await alternativesOf(tx, ids), []);
  });
});

test("the primary paradigm of every covered entry is the one the sourced fixture expects, with or without alternatives", async () => {
  const byId = new Map<string, (typeof WEAK_PARADIGM_FIXTURES)[number] | (typeof QUAD_PARADIGM_FIXTURES)[number]>([
    ...WEAK_PARADIGM_FIXTURES.map((fixture) => [fixture.id, fixture] as const),
    ...QUAD_PARADIGM_FIXTURES.map((fixture) => [fixture.id, fixture] as const),
  ]);
  await db.tx(async (tx) => {
    for (const printed of PRINTED_ALTERNATIVES_FIXTURES) {
      const weak = byId.get(printed.id);
      if (!weak) {
        continue;
      }
      const patternId = "choice" in weak ? await patternOfCode(weak.patternCode) : await resolvePattern(weak);
      assert.ok(patternId);
      const id = await insertEntry(tx, { text: weak.id, root: weak.root, morphPatternId: patternId });
      const stored = await storedParadigm(tx, id);
      const expected = {
        perfect: weak.perfect,
        imperfect_indicative: weak.imperfectIndicative,
        imperfect_subjunctive: weak.imperfectSubjunctive,
        imperfect_jussive: weak.imperfectJussive,
        imperative: weak.imperative,
      };
      for (const [mood, cells] of Object.entries(expected)) {
        for (const [person, form] of Object.entries(cells)) {
          assertArabicEqual(
            (stored as Record<string, Record<Person, string>>)[mood]?.[person as Person] ?? null,
            form,
            `${weak.id} ${mood}/${person}`,
          );
        }
      }
    }
  });
});

test("the printed verbal nouns are written in NFC and every one differs from the others", () => {
  for (const fixture of PRINTED_NOUN_ALTERNATIVES_FIXTURES) {
    for (const [kind, forms] of Object.entries(fixture.nouns)) {
      assert.ok(forms.length > 1, `${fixture.id} ${kind} prints one form`);
      assert.equal(new Set(forms).size, forms.length, `${fixture.id} repeats a form`);
      for (const form of forms) {
        assert.equal(form, form.normalize("NFC"), `${fixture.id}: ${form} is not NFC`);
      }
    }
  }
});

test("every verbal noun printed beside the stored one is produced after it, in the order of the table", async () => {
  await db.tx(async (tx) => {
    for (const fixture of PRINTED_NOUN_ALTERNATIVES_FIXTURES) {
      const id = await insertEntry(tx, {
        text: fixture.id,
        root: fixture.root,
        morphPatternId: await patternOfCode(fixture.patternCode),
      });
      const stored = await tx.one<{
        masdar: string | null;
        active_participle: string | null;
        passive_participle: string | null;
      }>("SELECT masdar, active_participle, passive_participle FROM lexical_entry WHERE id = $1", [id]);
      const produced = await nounsOf(tx, [id]);
      const kinds = Object.keys(fixture.nouns);
      for (const row of produced) {
        assert.ok(kinds.includes(row.noun), `${fixture.id} produces a ${row.noun}, which the table does not print`);
      }
      for (const [kind, printed] of Object.entries(fixture.nouns)) {
        const primary = stored[kind as keyof typeof stored];
        assert.ok(primary !== null, `${fixture.id} has no stored ${kind}`);
        assert.ok(
          printed.includes(primary),
          `${fixture.id}: the stored ${primary} is not among the printed ${printed.join(" / ")}\n${fixture.source}`,
        );
        const forms = produced.filter((row) => row.noun === kind).map((row) => row.form);
        assert.deepEqual(
          forms,
          printed.filter((form) => form !== primary),
          `${fixture.id} ${kind}\n${fixture.source}`,
        );
        for (const [index, form] of printed.filter((candidate) => candidate !== primary).entries()) {
          assertArabicEqual(forms[index] ?? null, form, `${fixture.id} ${kind}`);
        }
      }
    }
  });
});

test("an entry of any other sourced paradigm gets no alternative verbal noun", async () => {
  const covered = new Set(PRINTED_NOUN_ALTERNATIVES_FIXTURES.map((fixture) => fixture.id));
  await db.tx(async (tx) => {
    const ids: number[] = [];
    for (const fixture of WEAK_PARADIGM_FIXTURES) {
      if (covered.has(fixture.id)) {
        continue;
      }
      const patternId = await resolvePattern(fixture);
      if (patternId !== null) {
        ids.push(await insertEntry(tx, { text: fixture.id, root: fixture.root, morphPatternId: patternId }));
      }
    }
    for (const fixture of QUAD_PARADIGM_FIXTURES) {
      if (!covered.has(fixture.id)) {
        const patternId = await patternOfCode(fixture.patternCode);
        ids.push(await insertEntry(tx, { text: fixture.id, root: fixture.root, morphPatternId: patternId }));
      }
    }
    assert.ok(ids.length > 200);
    assert.deepEqual(await nounsOf(tx, ids), []);
  });
});
