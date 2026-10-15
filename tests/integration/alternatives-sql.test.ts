import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSqlState, type Db, findPatternByCode, insertEntry, openDatabase, storedParadigm } from "../harness";

const db = await openDatabase();

interface Alternative {
  voice: string;
  mood: string;
  person: string;
  ordinal: number;
  form: string;
}

const alternativesOf = (scope: Db, entryId: number) =>
  scope.rows<Alternative>(
    `SELECT voice::text, mood::text, person::text, ordinal, form
     FROM entry_alternative_forms(ARRAY[$1]::int[])
     ORDER BY voice, mood, person, ordinal`,
    [entryId],
  );

const insertAlternative = (
  scope: Db,
  input: {
    patternId: number;
    root?: string | null;
    voice?: string;
    mood: string;
    person: string;
    ordinal?: number;
    template: string;
    verbatim?: boolean;
  },
) =>
  scope.scalar<number>(
    `INSERT INTO morph_pattern_alternative (morph_pattern_id, root, voice, mood, person, ordinal, template, verbatim)
     VALUES ($1, $2, $3::voice_type, $4::affix_mood, $5::person_type, $6, $7, $8)
     RETURNING id`,
    [
      input.patternId,
      input.root ?? null,
      input.voice ?? "active",
      input.mood,
      input.person,
      input.ordinal ?? 1,
      input.template,
      input.verbatim ?? false,
    ],
  );

const JUSSIVE = "imperfect_jussive";
const THIRD_MASCULINE = "third_person_masculine_singular";

test("an entry without a pattern, without a root or without alternatives gets none", async () => {
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f1-a-u");
    const plain = await insertEntry(tx, { text: "no pattern", root: "كتب" });
    const withoutRoot = await insertEntry(tx, { text: "no root", morphPatternId: sound.id });
    const sample = await insertEntry(tx, { text: "sound verb", root: "كتب", morphPatternId: sound.id });
    assert.deepEqual(await alternativesOf(tx, plain), []);
    assert.deepEqual(await alternativesOf(tx, withoutRoot), []);
    assert.deepEqual(await alternativesOf(tx, sample), []);
    assert.deepEqual(
      await tx.rows("SELECT * FROM entry_alternative_forms(ARRAY[]::int[])"),
      [],
      "an empty list of entries gives nothing",
    );
    assert.deepEqual(await tx.rows("SELECT * FROM entry_alternative_forms(ARRAY[987654]::int[])"), []);
    assert.deepEqual(await tx.rows("SELECT * FROM entry_alternative_forms(NULL)"), []);
  });
});

test("a template is evaluated for the root of the entry and normalised like any other form", async () => {
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f1-a-u");
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      template: "يَ{1}ُ{2}ِّ",
    });
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      ordinal: 2,
      template: "يَ{1}ْ{2}ِ{3}ْ",
    });
    const entry = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: sound.id });
    assert.deepEqual(
      (await alternativesOf(tx, entry)).map((row) => [row.mood, row.person, row.ordinal, row.form]),
      [
        [JUSSIVE, THIRD_MASCULINE, 1, "يَكُتِّ"],
        [JUSSIVE, THIRD_MASCULINE, 2, "يَكْتِبْ"],
      ],
    );
    const geminate = await insertEntry(tx, { text: "مَدَّ", root: "مدد", morphPatternId: sound.id });
    assert.deepEqual(
      (await alternativesOf(tx, geminate)).map((row) => row.form),
      ["يَمُدِّ", "يَمْدِدْ"],
      "a doubled letter is joined by the same normalisation the primary forms go through",
    );
  });
});

test("an alternative of a four-radical pattern is evaluated for all four letters and only for a root of four letters", async () => {
  await db.tx(async (tx) => {
    const quad = await findPatternByCode(tx, "f1-a-i-quadriliteral");
    await insertAlternative(tx, {
      patternId: quad.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      template: "يَ{1}ْ{2}ُ{3}ْ{4}",
    });
    const entry = await insertEntry(tx, { text: "دَحْرَجَ", root: "دحرج", morphPatternId: quad.id });
    assert.deepEqual(
      (await alternativesOf(tx, entry)).map((row) => [row.mood, row.person, row.ordinal, row.form]),
      [[JUSSIVE, THIRD_MASCULINE, 1, "يَدْحُرْج"]],
    );
    await tx.exec("ALTER TABLE lexical_entry DISABLE TRIGGER trg_normalize_lexical_entry_root");
    const shortRoot = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: quad.id });
    assert.deepEqual(
      await alternativesOf(tx, shortRoot),
      [],
      "a three-letter root on a four-radical pattern is skipped",
    );

    const sound = await findPatternByCode(tx, "f1-a-u");
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      template: "يَ{1}ْ{2}ُ{3}",
    });
    const longRoot = await insertEntry(tx, { text: "دَحْرَجَ legacy", root: "دحرج", morphPatternId: sound.id });
    await tx.exec("ALTER TABLE lexical_entry ENABLE TRIGGER trg_normalize_lexical_entry_root");
    assert.deepEqual(
      await alternativesOf(tx, longRoot),
      [],
      "a four-letter root on a three-radical pattern is skipped",
    );
  });
});

test("an alternative that equals the primary form is dropped and a repeated one is listed once", async () => {
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f1-a-u");
    const entry = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: sound.id });
    const primary = (await storedParadigm(tx, entry)).imperfect_jussive?.third_person_masculine_singular;
    assert.equal(primary, "يَكْتُبْ");
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      template: "يَ{1}ْ{2}ُ{3}ْ",
    });
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      ordinal: 2,
      template: "يَ{1}ُ{2}ِ{3}ْ",
    });
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      ordinal: 3,
      template: "يَ{1}ُ{2}ِ{3}ْ",
    });
    assert.deepEqual(
      (await alternativesOf(tx, entry)).map((row) => [row.ordinal, row.form]),
      [[2, "يَكُتِبْ"]],
    );
  });
});

test("an alternative with a root belongs to that verb only, however its hamza was typed", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-u-hamza-elided-in-the-imperative");
    const spelled = ["أمر", "ءمر", "إمر", "ؤمر", "ئمر", "أ م ر"];
    const ids: number[] = [];
    for (const [index, root] of spelled.entries()) {
      ids.push(await insertEntry(tx, { text: `amr ${index}`, root, morphPatternId: pattern.id }));
    }
    const other = await insertEntry(tx, { text: "akl", root: "أكل", morphPatternId: pattern.id });
    const [first] = ids;
    assert.ok(first);
    const baseline = await alternativesOf(tx, first);
    assert.equal(baseline.length, 5);
    for (const id of ids) {
      assert.deepEqual(
        (await alternativesOf(tx, id)).map((row) => row.form),
        baseline.map((row) => row.form),
      );
    }
    assert.deepEqual(await alternativesOf(tx, other), []);

    const added = await insertAlternative(tx, {
      patternId: pattern.id,
      root: " أ ك ل ",
      mood: "imperative",
      person: "second_person_masculine_singular",
      template: "اُ{1}ْ{2}ُ{3}ْ",
    });
    assert.equal(
      await tx.scalar<string>("SELECT root FROM morph_pattern_alternative WHERE id = $1", [added]),
      "أكل",
      "the root is stored clean",
    );
    assert.deepEqual(
      (await alternativesOf(tx, other)).map((row) => row.form),
      ["اُؤْكُلْ"],
    );
  });
});

test("a verbatim template keeps the spelling it is written in", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-i-hollow-ya-hamzated-third");
    const entry = await insertEntry(tx, { text: "جَاءَ", root: "جيأ", morphPatternId: pattern.id });
    await tx.exec("DELETE FROM morph_pattern_alternative WHERE morph_pattern_id = $1", [pattern.id]);
    await insertAlternative(tx, {
      patternId: pattern.id,
      mood: "perfect",
      person: "third_person_masculine_plural",
      template: "{1}َائُوا",
    });
    assert.deepEqual(await alternativesOf(tx, entry), [], "normalised, the alternative is the primary form");
    await insertAlternative(tx, {
      patternId: pattern.id,
      mood: "perfect",
      person: "third_person_masculine_plural",
      ordinal: 2,
      template: "{1}َائُوا",
      verbatim: true,
    });
    assert.deepEqual(
      (await alternativesOf(tx, entry)).map((row) => row.form),
      ["جَائُوا"],
    );
  });
});

test("the infix of form VIII follows the first radical in an alternative as it does in the pattern", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f8-geminate");
    const assimilated = await insertEntry(tx, { text: "اِضْطَرَّ", root: "ضرر", morphPatternId: pattern.id });
    const plain = await insertEntry(tx, { text: "اِمْتَدَّ", root: "مدد", morphPatternId: pattern.id });
    const thirdMasculine = async (entryId: number, voice: string) =>
      (await alternativesOf(tx, entryId))
        .filter((row) => row.person === THIRD_MASCULINE && row.voice === voice)
        .map((row) => row.form);
    assert.deepEqual(await thirdMasculine(assimilated, "active"), ["يَضْطَرِّ", "يَضْطَرِرْ"]);
    assert.deepEqual(await thirdMasculine(assimilated, "passive"), ["يُضْطَرِّ", "يُضْطَرَرْ"]);
    assert.deepEqual(await thirdMasculine(plain, "active"), ["يَمْتَدِّ", "يَمْتَدِدْ"]);
    assert.deepEqual(await thirdMasculine(plain, "passive"), ["يُمْتَدِّ", "يُمْتَدَدْ"]);
  });
});

test("alternatives of another voice are kept apart from the active forms", async () => {
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f1-a-u");
    const entry = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: sound.id });
    await insertAlternative(tx, {
      patternId: sound.id,
      voice: "passive",
      mood: "perfect",
      person: THIRD_MASCULINE,
      template: "كُتَبَ",
    });
    await insertAlternative(tx, {
      patternId: sound.id,
      mood: "perfect",
      person: THIRD_MASCULINE,
      template: "{1}َ{2}َ{3}َ",
    });
    assert.deepEqual(
      (await alternativesOf(tx, entry)).map((row) => [row.voice, row.mood, row.form]),
      [["passive", "perfect", "كُتَبَ"]],
      "the active template equals the active primary and is dropped; the passive one is not compared with it",
    );
  });
});

test("many entries are answered by one statement and each gets only its own alternatives", async () => {
  await db.tx(async (tx) => {
    const geminate = await findPatternByCode(tx, "f1-a-u-geminate");
    const sound = await findPatternByCode(tx, "f1-a-u");
    const ids: number[] = [];
    for (let index = 0; index < 20; index++) {
      ids.push(await insertEntry(tx, { text: `g${index}`, root: "مدد", morphPatternId: geminate.id }));
    }
    const plain = await insertEntry(tx, { text: "plain", root: "كتب", morphPatternId: sound.id });
    const rows = await tx.rows<{ lexical_entry_id: number }>(
      "SELECT lexical_entry_id FROM entry_alternative_forms($1::int[])",
      [`{${[...ids, plain].join(",")}}`],
    );
    assert.equal(rows.length, 20 * 22);
    assert.ok(rows.every((row) => row.lexical_entry_id !== plain));
    const perEntry = new Map<number, number>();
    for (const row of rows) {
      perEntry.set(row.lexical_entry_id, (perEntry.get(row.lexical_entry_id) ?? 0) + 1);
    }
    assert.deepEqual([...new Set(perEntry.values())], [22]);
  });
});

test("an alternative never changes the primary paradigm, the stems or the search vector", async () => {
  await db.tx(async (tx) => {
    const geminate = await findPatternByCode(tx, "f1-a-u-geminate");
    const entry = await insertEntry(tx, { text: "مَدَّ", root: "مدد", morphPatternId: geminate.id });
    const snapshot = () =>
      tx.rows(
        `SELECT e.masdar, e.active_participle, e.passive_participle, e.search_vector::text AS vector,
                (SELECT string_agg(c.voice::text || c.mood::text || c.person::text || c.form, '|' ORDER BY c.voice, c.mood, c.person)
                 FROM conjugation c WHERE c.lexical_entry_id = e.id) AS forms
         FROM lexical_entry e WHERE e.id = $1`,
        [entry],
      );
    const before = await snapshot();
    await insertAlternative(tx, {
      patternId: geminate.id,
      mood: "perfect",
      person: THIRD_MASCULINE,
      template: "{1}َ{2}َّ",
    });
    await insertAlternative(tx, {
      patternId: geminate.id,
      mood: "imperative",
      person: "second_person_dual",
      ordinal: 2,
      template: "{1}ُ{2}َّا",
    });
    await tx.exec("UPDATE morph_pattern_alternative SET template = template || 'ْ'");
    await tx.exec("DELETE FROM morph_pattern_alternative WHERE ordinal = 2");
    assert.deepEqual(await snapshot(), before);
  });
});

test("the key, the ordinal and the template are constrained and a pattern takes its alternatives with it", async () => {
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f1-a-u");
    await insertAlternative(tx, { patternId: sound.id, mood: JUSSIVE, person: THIRD_MASCULINE, template: "x" });
    const duplicate = await tx.failure(
      `INSERT INTO morph_pattern_alternative (morph_pattern_id, mood, person, template)
       VALUES ($1, 'imperfect_jussive', 'third_person_masculine_singular', 'y')`,
      [sound.id],
    );
    assertSqlState(duplicate, "23505", /unique_morph_pattern_alternative_key/);
    await insertAlternative(tx, {
      patternId: sound.id,
      root: "كتب",
      mood: JUSSIVE,
      person: THIRD_MASCULINE,
      template: "y",
    });
    const duplicateRoot = await tx.failure(
      `INSERT INTO morph_pattern_alternative (morph_pattern_id, root, mood, person, template)
       VALUES ($1, 'كتب', 'imperfect_jussive', 'third_person_masculine_singular', 'z')`,
      [sound.id],
    );
    assertSqlState(duplicateRoot, "23505", /unique_morph_pattern_alternative_key/);
    const zero = await tx.failure(
      `INSERT INTO morph_pattern_alternative (morph_pattern_id, mood, person, ordinal, template)
       VALUES ($1, 'perfect', 'first_person_singular', 0, 'y')`,
      [sound.id],
    );
    assertSqlState(zero, "23514", /chk_morph_pattern_alternative_ordinal/);
    const blank = await tx.failure(
      `INSERT INTO morph_pattern_alternative (morph_pattern_id, mood, person, template)
       VALUES ($1, 'perfect', 'first_person_singular', '  ')`,
      [sound.id],
    );
    assertSqlState(blank, "23514", /chk_morph_pattern_alternative_template/);
    const orphan = await tx.failure(
      `INSERT INTO morph_pattern_alternative (morph_pattern_id, mood, person, template)
       VALUES (987654, 'perfect', 'first_person_singular', 'y')`,
    );
    assertSqlState(orphan, "23503");
  });

  await db.tx(async (tx) => {
    const pattern = await tx.scalar<number>(
      `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical, perfect_vowel, imperfect_vowel)
       SELECT 'f1-u-i-test-alternatives', 1, vocalic_template, 'test only, alternatives', rules, TRUE, 'u', 'i'
       FROM morph_pattern WHERE code = 'f1-a-u' RETURNING id`,
    );
    await insertAlternative(tx, { patternId: pattern, mood: JUSSIVE, person: THIRD_MASCULINE, template: "x" });
    await tx.exec("DELETE FROM morph_pattern WHERE id = $1", [pattern]);
    assert.equal(
      await tx.scalar<number>("SELECT count(*)::int FROM morph_pattern_alternative WHERE morph_pattern_id = $1", [
        pattern,
      ]),
      0,
    );
  });
});

test("the shipped alternatives name existing patterns, use only known placeholders and belong to the shapes they were written for", async () => {
  const rows = await db.rows<{
    code: string;
    radical_count: number;
    template: string;
    verbatim: boolean;
    root: string | null;
  }>(
    `SELECT p.code, p.radical_count, a.template, a.verbatim, a.root
     FROM morph_pattern_alternative a JOIN morph_pattern p ON p.id = a.morph_pattern_id`,
  );
  assert.ok(rows.length >= 180);
  for (const row of rows) {
    const placeholders = row.radical_count === 4 ? /\{[1234]\}/g : /\{[123]\}/g;
    assert.doesNotMatch(row.template.replace(placeholders, ""), /[{}]/, `${row.code}: ${row.template}`);
    assert.equal(row.template, row.template.normalize("NFC"));
  }
  const patterns = new Set(rows.map((row) => row.code));
  assert.deepEqual(
    [...patterns].sort(),
    [
      "f1-a-a",
      "f1-a-i-geminate",
      "f1-a-i-hollow-ya-hamzated-third",
      "f1-a-u-geminate",
      "f1-a-u-hamza-elided-in-the-imperative",
      "f1-a-u-hollow-waw",
      "f1-a-u-hollow-waw-hamzated-third",
      "f1-i-a-geminate",
      "f1-i-a-hollow-ya-hamzated-third",
      "f1-u-u-geminate",
      "f10-geminate",
      "f3-geminate",
      "f4-geminate",
      "f4-quadriliteral",
      "f6-geminate",
      "f7-geminate",
      "f8-geminate",
      "f9",
    ].sort(),
  );
  assert.deepEqual(
    [...new Set(rows.filter((row) => row.root !== null).map((row) => `${row.code} ${row.root}`))].sort(),
    ["f1-a-a سأل", "f1-a-u-hamza-elided-in-the-imperative أمر", "f1-a-u-hollow-waw كون"].sort(),
  );
  assert.deepEqual([...new Set(rows.filter((row) => row.verbatim).map((row) => row.code))].sort(), [
    "f1-a-i-hollow-ya-hamzated-third",
    "f1-a-u-hollow-waw-hamzated-third",
    "f1-i-a-hollow-ya-hamzated-third",
  ]);
});

test("an alternative of the passive voice belongs to a pattern with a passive and is listed only for a stored passive cell", async () => {
  const withoutPassive = await db.rows<{ code: string }>(
    `SELECT DISTINCT p.code
     FROM morph_pattern_alternative a JOIN morph_pattern p ON p.id = a.morph_pattern_id
     WHERE a.voice = 'passive' AND NOT has_passive_rules(p.rules)`,
  );
  assert.deepEqual(withoutPassive, []);
  const passive = await db.rows<{ code: string; mood: string; rows: number }>(
    `SELECT p.code, a.mood::text, count(*)::int AS rows
     FROM morph_pattern_alternative a JOIN morph_pattern p ON p.id = a.morph_pattern_id
     WHERE a.voice = 'passive'
     GROUP BY p.code, a.mood ORDER BY p.code, a.mood`,
  );
  assert.equal(passive.length, 7 + 3 * 4);
  assert.equal(
    passive.reduce((sum, row) => sum + row.rows, 0),
    91,
  );

  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-u-geminate");
    const full = await insertEntry(tx, { text: "مَدَّ", root: "مدد", morphPatternId: pattern.id });
    const opted = await insertEntry(tx, {
      text: "مَدَّ opted out",
      root: "مدد",
      morphPatternId: pattern.id,
      overrides: { no_passive: true },
    });
    const voices = async (entryId: number) => [...new Set((await alternativesOf(tx, entryId)).map((row) => row.voice))];
    assert.deepEqual(await voices(full), ["active", "passive"]);
    assert.deepEqual(await voices(opted), ["active"]);
  });
});

test("every shipped alternative carries a note that names its source, and the notes record the checks against Wright", async () => {
  const rows = await db.rows<{ code: string; root: string | null; voice: string; note: string | null }>(
    `SELECT p.code, a.root, a.voice::text, a.note
     FROM morph_pattern_alternative a JOIN morph_pattern p ON p.id = a.morph_pattern_id`,
  );
  for (const row of rows) {
    assert.ok(row.note && /Wiktionary|Wright/.test(row.note), `${row.code} ${row.root ?? ""} has no sourced note`);
  }
  const notesOf = (filter: (row: (typeof rows)[number]) => boolean) => rows.filter(filter).map((row) => row.note ?? "");
  const form9 = notesOf((row) => row.code === "f9");
  assert.ok(form9.length > 0);
  assert.ok(form9.every((note) => note.includes("§123") && note.includes("Tamim") && note.includes("Hijaz")));
  const kana = notesOf((row) => row.code === "f1-a-u-hollow-waw" && row.root === "كون");
  assert.equal(kana.length, 5);
  assert.ok(kana.every((note) => note.includes("§151 rem.")));
  const fourth = notesOf((row) => row.code === "f4-quadriliteral");
  assert.ok(fourth.length > 0);
  assert.ok(fourth.every((note) => note.includes("§118") && note.includes("§123")));
});
