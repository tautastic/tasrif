import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSIVE_ABSENT_FIXTURES } from "../fixtures/passive-absent.ts";
import { PASSIVE_PARADIGM_FIXTURES } from "../fixtures/passive-paradigms.ts";
import {
  assertParadigmEqual,
  assertSqlState,
  conjugate,
  type Db,
  findPatternByCode,
  insertEntry,
  type Mood,
  openDatabase,
  type Paradigm,
  type PatternRow,
  PERSONS,
  type Person,
} from "../harness";
import { passiveParadigm } from "../paradigm/passive-harness.ts";

const db = await openDatabase();

const PASSIVE_MOODS: Mood[] = ["perfect", "imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"];

const storedVoice = async (scope: Db, entryId: number, voice: "active" | "passive"): Promise<Paradigm> => {
  const rows = await scope.rows<{ mood: Mood; person: Person; form: string }>(
    "SELECT mood::text AS mood, person::text AS person, form FROM conjugation WHERE lexical_entry_id = $1 AND voice = $2::voice_type",
    [entryId, voice],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

const countVoice = (scope: Db, entryId: number, voice: "active" | "passive"): Promise<number> =>
  scope.scalar<number>("SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = $1 AND voice = $2::voice_type", [
    entryId,
    voice,
  ]);

const patternCache = new Map<string, PatternRow>();
const patternByCode = async (code: string): Promise<PatternRow> => {
  const cached = patternCache.get(code);
  if (cached) {
    return cached;
  }
  const pattern = await findPatternByCode(db, code);
  patternCache.set(code, pattern);
  return pattern;
};

const PASSIVE_CELLS = PERSONS.length * PASSIVE_MOODS.length;

test("regeneration stores every passive cell of every fixture under the passive voice", async () => {
  for (const fixture of PASSIVE_PARADIGM_FIXTURES) {
    const pattern = await patternByCode(fixture.patternCode);
    await db.tx(async (tx) => {
      const entryId = await insertEntry(tx, {
        text: fixture.citationForm,
        root: fixture.root,
        morphPatternId: pattern.id,
      });
      const stored = await storedVoice(tx, entryId, "passive");
      for (const [mood, cells] of [
        ["perfect", fixture.perfect],
        ["imperfect_indicative", fixture.imperfectIndicative],
        ["imperfect_subjunctive", fixture.imperfectSubjunctive],
        ["imperfect_jussive", fixture.imperfectJussive],
      ] as const) {
        assertParadigmEqual(stored[mood] ?? {}, cells, `${fixture.id} stored ${mood}\n${fixture.source}`);
      }
      assert.equal(stored.imperative, undefined, `${fixture.id} stores no passive imperative`);
      assert.equal(await countVoice(tx, entryId, "passive"), PASSIVE_CELLS, fixture.id);
    });
  }
});

test("the stored passive paradigm is the paradigm the pattern preview computes from the same rules", async () => {
  for (const fixture of PASSIVE_PARADIGM_FIXTURES) {
    const pattern = await patternByCode(fixture.patternCode);
    await db.tx(async (tx) => {
      const entryId = await insertEntry(tx, {
        text: fixture.citationForm,
        root: fixture.root,
        morphPatternId: pattern.id,
      });
      assert.deepEqual(
        await storedVoice(tx, entryId, "passive"),
        await passiveParadigm(tx, fixture.root, pattern.id),
        fixture.id,
      );
    });
  }
});

test("active rows are untouched by the passive voice and do not collide with it on the unique key", async () => {
  const pattern = await patternByCode("f1-a-u");
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: pattern.id });
    assert.equal(await countVoice(tx, entryId, "active"), 57);
    assert.equal(await countVoice(tx, entryId, "passive"), PASSIVE_CELLS);
    assert.deepEqual(await storedVoice(tx, entryId, "active"), await conjugate(tx, "كتب", pattern.id));
    const sameCell = await tx.rows<{ voice: string; form: string }>(
      `SELECT voice::text, form FROM conjugation
       WHERE lexical_entry_id = $1 AND mood = 'perfect' AND person = 'third_person_masculine_singular'
       ORDER BY voice`,
      [entryId],
    );
    assert.deepEqual(
      sameCell.map((row) => row.voice),
      ["active", "passive"],
    );
    assert.notEqual(sameCell[0]?.form, sameCell[1]?.form);
    const duplicate = await tx.failure(
      `INSERT INTO conjugation (lexical_entry_id, voice, mood, person, form)
       VALUES ($1, 'passive', 'perfect', 'third_person_masculine_singular', 'x')`,
      [entryId],
    );
    assertSqlState(duplicate, "23505");
  });
});

test("no_passive stores no passive rows, and toggling it adds and removes them without touching the active rows", async () => {
  const pattern = await patternByCode("f1-a-i");
  await db.tx(async (tx) => {
    const suppressed = await insertEntry(tx, {
      text: "ضَرَبَ",
      root: "ضرب",
      morphPatternId: pattern.id,
      overrides: { no_passive: true },
    });
    assert.equal(await countVoice(tx, suppressed, "passive"), 0);
    assert.equal(await countVoice(tx, suppressed, "active"), 57);

    await tx.exec("UPDATE lexical_entry SET morphology_overrides = NULL WHERE id = $1", [suppressed]);
    assert.equal(await countVoice(tx, suppressed, "passive"), PASSIVE_CELLS);

    await tx.exec(`UPDATE lexical_entry SET morphology_overrides = '{"no_passive": true}'::jsonb WHERE id = $1`, [
      suppressed,
    ]);
    assert.equal(await countVoice(tx, suppressed, "passive"), 0);
    assert.equal(await countVoice(tx, suppressed, "active"), 57);

    await tx.exec(`UPDATE lexical_entry SET morphology_overrides = '{"no_passive": false}'::jsonb WHERE id = $1`, [
      suppressed,
    ]);
    assert.equal(await countVoice(tx, suppressed, "passive"), PASSIVE_CELLS);
  });
});

test("no_passive leaves no passive row for any verb whose table has no full passive", async () => {
  for (const fixture of PASSIVE_ABSENT_FIXTURES) {
    if (fixture.patternCode === null) {
      continue;
    }
    const pattern = await patternByCode(fixture.patternCode);
    await db.tx(async (tx) => {
      const entryId = await insertEntry(tx, {
        text: fixture.citationForm,
        root: fixture.root,
        morphPatternId: pattern.id,
        overrides: { no_passive: true },
      });
      assert.equal(await countVoice(tx, entryId, "passive"), 0, `${fixture.id}\n${fixture.source}`);
      assert.ok((await countVoice(tx, entryId, "active")) > 0, `${fixture.id} keeps its active rows`);
    });
  }
});

test("the third masculine singular of every impersonal passive table is the passive the pattern generates", async () => {
  let checked = 0;
  for (const fixture of PASSIVE_ABSENT_FIXTURES) {
    if (fixture.impersonal === null || fixture.patternCode === null) {
      continue;
    }
    const pattern = await patternByCode(fixture.patternCode);
    const hasPassive = await db.scalar<boolean>("SELECT has_passive_rules(rules) FROM morph_pattern WHERE id = $1", [
      pattern.id,
    ]);
    if (!hasPassive) {
      continue;
    }
    const paradigm = await passiveParadigm(db, fixture.root, pattern.id);
    const person = "third_person_masculine_singular";
    assert.equal(paradigm.perfect?.[person], fixture.impersonal.perfect, `${fixture.id} perfect\n${fixture.source}`);
    assert.equal(
      paradigm.imperfect_indicative?.[person],
      fixture.impersonal.imperfectIndicative,
      `${fixture.id} indicative\n${fixture.source}`,
    );
    assert.equal(
      paradigm.imperfect_subjunctive?.[person],
      fixture.impersonal.imperfectSubjunctive,
      `${fixture.id} subjunctive\n${fixture.source}`,
    );
    assert.equal(
      paradigm.imperfect_jussive?.[person],
      fixture.impersonal.imperfectJussive,
      `${fixture.id} jussive\n${fixture.source}`,
    );
    checked += 1;
  }
  assert.ok(checked > 0);
});

test("editing the passive rules of a pattern regenerates the passive rows of its entries and removing them deletes the rows", async () => {
  const pattern = await patternByCode("f2");
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَّبَ", root: "كتب", morphPatternId: pattern.id });
    assert.equal((await storedVoice(tx, entryId, "passive")).perfect?.third_person_masculine_singular, "كُتِّبَ");

    await tx.exec(`UPDATE morph_pattern SET rules = rules || '{"passive_perfect": "{1}ُ{2}ُّ{3}"}'::jsonb WHERE id = $1`, [
      pattern.id,
    ]);
    assert.equal((await storedVoice(tx, entryId, "passive")).perfect?.third_person_masculine_singular, "كُتُّبَ");
    assert.equal(await countVoice(tx, entryId, "active"), 57);

    await tx.exec(
      `UPDATE morph_pattern
       SET rules = rules - 'passive_perfect' - 'passive_imperfect_stem'
       WHERE id = $1`,
      [pattern.id],
    );
    assert.equal(await countVoice(tx, entryId, "passive"), 0);
    assert.equal(await countVoice(tx, entryId, "active"), 57);
  });
});

test("moving an entry to a pattern without passive rules deletes its passive rows", async () => {
  const withPassive = await patternByCode("f2");
  const withoutPassive = await patternByCode("f7");
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَّبَ", root: "كتب", morphPatternId: withPassive.id });
    assert.equal(await countVoice(tx, entryId, "passive"), PASSIVE_CELLS);
    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = $2 WHERE id = $1", [entryId, withoutPassive.id]);
    assert.equal(await countVoice(tx, entryId, "passive"), 0);
    assert.ok((await countVoice(tx, entryId, "active")) > 0);
    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = NULL WHERE id = $1", [entryId]);
    assert.equal(await countVoice(tx, entryId, "passive"), 0);
    assert.equal(await countVoice(tx, entryId, "active"), 0);
  });
});

test("regenerate_all_derived_stems keeps the passive rows and is idempotent", async () => {
  const pattern = await patternByCode("f3");
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "قَاتَلَ", root: "قتل", morphPatternId: pattern.id });
    const before = await storedVoice(tx, entryId, "passive");
    await tx.exec("SELECT regenerate_all_derived_stems()");
    await tx.exec("SELECT regenerate_all_derived_stems()");
    assert.deepEqual(await storedVoice(tx, entryId, "passive"), before);
    assert.equal(await countVoice(tx, entryId, "passive"), PASSIVE_CELLS);
  });
});

test("a vowelless ya after damma is written waw in every passive form (Wright 147)", async () => {
  const pattern = await patternByCode("f1-i-a");
  const paradigm = await passiveParadigm(db, "يسر", pattern.id);
  assert.equal(paradigm.perfect?.third_person_masculine_singular, "يُسِرَ");
  assert.equal(paradigm.imperfect_indicative?.third_person_masculine_singular, "يُوسَرُ");
  assert.equal(paradigm.imperfect_indicative?.first_person_singular, "أُوسَرُ");
  assert.equal(paradigm.imperfect_jussive?.second_person_feminine_plural, "تُوسَرْنَ");
});

test("a pattern without passive rules generates no passive rows", async () => {
  const pattern = await patternByCode("f9");
  const paradigm = await passiveParadigm(db, "حمر", pattern.id);
  assert.deepEqual(paradigm, {});
});
