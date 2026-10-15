import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSqlState, type Db, findPatternByCode, insertEntry, openDatabase } from "../harness";

const db = await openDatabase();

interface AlternativeNoun {
  noun: string;
  ordinal: number;
  form: string;
}

const nounsOf = (scope: Db, entryId: number) =>
  scope.rows<AlternativeNoun>(
    `SELECT noun::text, ordinal, form
     FROM entry_alternative_nouns(ARRAY[$1]::int[])`,
    [entryId],
  );

const insertNoun = (
  scope: Db,
  input: {
    patternId: number;
    root?: string | null;
    noun?: string;
    ordinal?: number;
    template: string;
    verbatim?: boolean;
  },
) =>
  scope.scalar<number>(
    `INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, root, noun, ordinal, template, verbatim)
     VALUES ($1, $2, $3::alternative_noun_kind, $4, $5, $6)
     RETURNING id`,
    [
      input.patternId,
      input.root ?? null,
      input.noun ?? "masdar",
      input.ordinal ?? 1,
      input.template,
      input.verbatim ?? false,
    ],
  );

const storedNouns = (scope: Db, entryId: number) =>
  scope.one<{ masdar: string | null; active_participle: string | null; passive_participle: string | null }>(
    "SELECT masdar, active_participle, passive_participle FROM lexical_entry WHERE id = $1",
    [entryId],
  );

test("the shipped alternative verbal nouns are verb-specific rows of the first form of the quadriliteral verbs and of the two hamzated-first final-weak verbs", async () => {
  const rows = await db.rows<{ code: string; root: string | null; noun: string; ordinal: number; template: string }>(
    `SELECT p.code, a.root, a.noun::text, a.ordinal, a.template
     FROM morph_pattern_alternative_noun a JOIN morph_pattern p ON p.id = a.morph_pattern_id
     ORDER BY a.id`,
  );
  assert.deepEqual(
    rows.map((row) => `${row.code} ${row.root} ${row.noun} ${row.ordinal}`).sort(),
    [
      "f1-a-i-quadriliteral زلزل masdar 1",
      "f1-a-i-quadriliteral ثرثر masdar 1",
      "f1-a-i-quadriliteral وسوس masdar 1",
      "f1-a-i-quadriliteral وسوس masdar 2",
      "f1-a-a-final-weak-hamzated-first أبي masdar 1",
      "f1-a-i-hollow-waw-final-weak-hamzated-first أوي masdar 1",
      "f1-a-i-hollow-waw-final-weak-hamzated-first أوي masdar 2",
    ].sort(),
  );
  for (const row of rows) {
    assert.doesNotMatch(row.template.replace(/\{[1234]\}/g, ""), /[{}]/, row.template);
    assert.equal(row.template, row.template.normalize("NFC"));
  }
});

test("a verb gets the verbal nouns written for its root and no other verb of the pattern does", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-i-quadriliteral");
    const wanted: Array<[string, string, string[]]> = [
      ["زَلْزَلَ", "زلزل", ["زِلْزَال"]],
      ["ثَرْثَرَ", "ثرثر", ["ثَرْثَار"]],
      ["وَسْوَسَ", "وسوس", ["وَسْوَاس", "وِسْوَاس"]],
      ["دَحْرَجَ", "دحرج", []],
    ];
    for (const [text, root, expected] of wanted) {
      const id = await insertEntry(tx, { text, root, morphPatternId: pattern.id });
      assert.deepEqual(
        (await nounsOf(tx, id)).map((row) => [row.noun, row.form]),
        expected.map((form) => ["masdar", form]),
        root,
      );
    }
  });
});

test("an alternative with no root belongs to every entry of the pattern and is evaluated like the stored noun", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f2");
    await insertNoun(tx, { patternId: pattern.id, noun: "masdar", ordinal: 1, template: "{1}َ{2}ْ{3}َلَة" });
    await insertNoun(tx, { patternId: pattern.id, noun: "active_participle", ordinal: 1, template: "مُ{1}َ{2}ِّ{3}ٌ" });
    const first = await insertEntry(tx, { text: "عَلَّمَ", root: "علم", morphPatternId: pattern.id });
    const second = await insertEntry(tx, { text: "كَتَّبَ", root: "كتب", morphPatternId: pattern.id });
    assert.deepEqual(
      (await nounsOf(tx, first)).map((row) => [row.noun, row.form]),
      [
        ["masdar", "عَلْمَلَة"],
        ["active_participle", "مُعَلِّمٌ"],
      ],
    );
    assert.deepEqual(
      (await nounsOf(tx, second)).map((row) => row.form),
      ["كَتْبَلَة", "مُكَتِّبٌ"],
    );
  });
});

test("an alternative equal to the stored noun is dropped and a repeated one is listed once with its lowest ordinal", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f2");
    const id = await insertEntry(tx, { text: "عَلَّمَ", root: "علم", morphPatternId: pattern.id });
    const stored = await storedNouns(tx, id);
    assert.equal(stored.masdar, "تَعْلِيم");
    await insertNoun(tx, { patternId: pattern.id, ordinal: 1, template: "تَ{1}ْ{2}ِي{3}" });
    await insertNoun(tx, { patternId: pattern.id, ordinal: 2, template: "{1}َ{2}ْ{3}ٌ" });
    await insertNoun(tx, { patternId: pattern.id, ordinal: 3, template: "{1}َ{2}ْ{3}ٌ" });
    await insertNoun(tx, { patternId: pattern.id, ordinal: 4, template: "تَ{1}ْ{2}ِي{3}" });
    assert.deepEqual(await nounsOf(tx, id), [{ noun: "masdar", ordinal: 2, form: "عَلْمٌ" }]);
  });
});

test("alternatives are listed in the order of their ordinal and an alternative equal to a stored participle is dropped", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f2");
    await insertNoun(tx, { patternId: pattern.id, ordinal: 1, template: "ي{1}{2}{3}ٌ" });
    await insertNoun(tx, { patternId: pattern.id, ordinal: 2, template: "ا{1}{2}{3}ٌ" });
    await insertNoun(tx, { patternId: pattern.id, noun: "active_participle", template: "مُ{1}َ{2}ِّ{3}" });
    await insertNoun(tx, { patternId: pattern.id, noun: "passive_participle", template: "مُ{1}َ{2}َّ{3}" });
    const id = await insertEntry(tx, { text: "عَلَّمَ", root: "علم", morphPatternId: pattern.id });
    const stored = await storedNouns(tx, id);
    assert.equal(stored.active_participle, "مُعَلِّم");
    assert.equal(stored.passive_participle, "مُعَلَّم");
    assert.deepEqual(
      (await nounsOf(tx, id)).map((row) => [row.noun, row.ordinal, row.form]),
      [
        ["masdar", 1, "يعلمٌ"],
        ["masdar", 2, "اعلمٌ"],
      ],
    );
  });
});

test("a participle that the entry does not carry gets no alternative, as with no_passive", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f2");
    await insertNoun(tx, { patternId: pattern.id, noun: "passive_participle", template: "مُ{1}َ{2}َّ{3}ٌ" });
    const passive = await insertEntry(tx, { text: "عَلَّمَ", root: "علم", morphPatternId: pattern.id });
    const withoutPassive = await insertEntry(tx, {
      text: "عَلَّمَ no passive",
      root: "علم",
      morphPatternId: pattern.id,
      overrides: { no_passive: true },
    });
    assert.notEqual((await storedNouns(tx, passive)).passive_participle, null);
    assert.equal((await storedNouns(tx, withoutPassive)).passive_participle, null);
    assert.equal((await nounsOf(tx, passive)).length, 1);
    assert.deepEqual(await nounsOf(tx, withoutPassive), []);
  });
});

test("an entry without a pattern, without a root or with a root of another length gets none", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-i-quadriliteral");
    await insertNoun(tx, { patternId: pattern.id, template: "{1}ِ{2}ْ{3}ٌ" });
    const plain = await insertEntry(tx, { text: "no pattern", root: "زلزل" });
    const withoutRoot = await insertEntry(tx, { text: "no root", morphPatternId: pattern.id });
    assert.deepEqual(await nounsOf(tx, plain), []);
    assert.deepEqual(await nounsOf(tx, withoutRoot), []);

    await tx.exec("ALTER TABLE lexical_entry DISABLE TRIGGER trg_normalize_lexical_entry_root");
    const mismatched = await insertEntry(tx, { text: "دَحْرَجَ legacy", root: "كتب", morphPatternId: pattern.id });
    await tx.exec("ALTER TABLE lexical_entry ENABLE TRIGGER trg_normalize_lexical_entry_root");
    assert.deepEqual(await nounsOf(tx, mismatched), []);

    const stale = await insertEntry(tx, { text: "زَلْزَلَ stale", root: "زلزل", morphPatternId: pattern.id });
    assert.notEqual((await storedNouns(tx, stale)).masdar, null);
    await tx.exec("SET LOCAL session_replication_role = replica");
    await tx.exec("UPDATE lexical_entry SET root = 'كتب' WHERE id = $1", [stale]);
    await tx.exec("SET LOCAL session_replication_role = origin");
    assert.notEqual((await storedNouns(tx, stale)).masdar, null);
    assert.deepEqual(await nounsOf(tx, stale), []);
  });
});

test("the root of an alternative is stored without marks, found by its hamza and a verbatim template is kept", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f2");
    const id = await insertNoun(tx, { patternId: pattern.id, root: "سَأَلَ", template: "{1}ُؤْ{3}ٌ", verbatim: true });
    assert.equal(await tx.scalar<string>("SELECT root FROM morph_pattern_alternative_noun WHERE id = $1", [id]), "سأل");
    const entry = await insertEntry(tx, { text: "سَأَّلَ", root: "سآل", morphPatternId: pattern.id });
    assert.deepEqual(
      (await nounsOf(tx, entry)).map((row) => row.form),
      ["سُؤْلٌ"],
    );
  });
});

test("a verbatim template keeps its spelling and a normalised one does not", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f2");
    const id = await insertEntry(tx, { text: "عَلَّمَ", root: "علم", morphPatternId: pattern.id });
    await insertNoun(tx, { patternId: pattern.id, ordinal: 1, template: "{1}َائُ{2}" });
    assert.deepEqual(
      (await nounsOf(tx, id)).map((row) => row.form),
      ["عَاؤُل"],
    );
    await insertNoun(tx, { patternId: pattern.id, ordinal: 2, template: "{1}َائُ{2}", verbatim: true });
    assert.deepEqual(
      (await nounsOf(tx, id)).map((row) => row.form),
      ["عَاؤُل", "عَائُل"],
    );
  });
});

test("the infix of form VIII follows the first radical in an alternative noun as it does in the pattern", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f8");
    await insertNoun(tx, { patternId: pattern.id, template: "اِ{1}ْتِ{2}َا{3}ٌ" });
    const id = await insertEntry(tx, { text: "اِزْدَهَرَ", root: "زهر", morphPatternId: pattern.id });
    const produced = await nounsOf(tx, id);
    assert.equal(produced.length, 1);
    assert.equal(produced[0]?.form, "اِزْدِهَارٌ");
  });
});

test("many entries are answered by one statement and each gets only its own alternatives", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-i-quadriliteral");
    const ids = [
      await insertEntry(tx, { text: "زَلْزَلَ", root: "زلزل", morphPatternId: pattern.id }),
      await insertEntry(tx, { text: "وَسْوَسَ", root: "وسوس", morphPatternId: pattern.id }),
      await insertEntry(tx, { text: "دَحْرَجَ", root: "دحرج", morphPatternId: pattern.id }),
    ];
    const rows = await tx.rows<{ lexical_entry_id: number; form: string }>(
      `SELECT lexical_entry_id, form FROM entry_alternative_nouns($1::int[])`,
      [`{${ids.join(",")}}`],
    );
    assert.deepEqual(
      rows.map((row) => [row.lexical_entry_id, row.form]),
      [
        [ids[0], "زِلْزَال"],
        [ids[1], "وَسْوَاس"],
        [ids[1], "وِسْوَاس"],
      ],
    );
    assert.deepEqual(await tx.rows("SELECT * FROM entry_alternative_nouns(ARRAY[]::int[])"), []);
  });
});

test("an alternative noun never changes the stored nouns, the paradigm or the search vector", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPatternByCode(tx, "f1-a-i-quadriliteral");
    const id = await insertEntry(tx, { text: "زَلْزَلَ", root: "زلزل", morphPatternId: pattern.id });
    const snapshot = () =>
      tx.one<{ stored: string; conjugations: string; vector: string | null }>(
        `SELECT (masdar, active_participle, passive_participle)::text AS stored,
                (SELECT string_agg(form, ',' ORDER BY id) FROM conjugation WHERE lexical_entry_id = e.id) AS conjugations,
                search_vector::text AS vector
         FROM lexical_entry e WHERE id = $1`,
        [id],
      );
    const before = await snapshot();
    await insertNoun(tx, { patternId: pattern.id, root: "زلزل", ordinal: 5, template: "{1}ُ{2}ْ{3}ُ{4}" });
    assert.deepEqual(await snapshot(), before);
  });
});

test("the key, the ordinal and the template are constrained and a pattern takes its alternative nouns with it", async () => {
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f2");
    await insertNoun(tx, { patternId: sound.id, template: "x" });
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, noun, template)
         VALUES ($1, 'masdar', 'y')`,
        [sound.id],
      ),
      "23505",
      /unique_morph_pattern_alternative_noun_key/,
    );
  });
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f2");
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, noun, ordinal, template)
         VALUES ($1, 'masdar', 0, 'y')`,
        [sound.id],
      ),
      "23514",
      /chk_morph_pattern_alternative_noun_ordinal/,
    );
  });
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f2");
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, noun, template)
         VALUES ($1, 'masdar', '  ')`,
        [sound.id],
      ),
      "23514",
      /chk_morph_pattern_alternative_noun_template/,
    );
  });
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, noun, template)
         VALUES (987654, 'masdar', 'y')`,
      ),
      "23503",
    );
  });
  await db.tx(async (tx) => {
    const sound = await findPatternByCode(tx, "f2");
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, noun, template)
         VALUES ($1, 'plural', 'y')`,
        [sound.id],
      ),
      "22P02",
    );
  });
  await db.tx(async (tx) => {
    const pattern = await tx.scalar<number>(
      `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical, perfect_vowel, imperfect_vowel)
       SELECT 'f1-u-i-test-alternative-nouns', 1, vocalic_template, 'test only, alternative nouns', rules, TRUE, 'u', 'i'
       FROM morph_pattern WHERE code = 'f1-a-u' RETURNING id`,
    );
    await insertNoun(tx, { patternId: pattern, template: "x" });
    await tx.exec("DELETE FROM morph_pattern WHERE id = $1", [pattern]);
    assert.equal(
      await tx.scalar<number>("SELECT count(*)::int FROM morph_pattern_alternative_noun WHERE morph_pattern_id = $1", [
        pattern,
      ]),
      0,
    );
  });
});
