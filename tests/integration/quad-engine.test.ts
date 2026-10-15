import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  assertParadigmEqual,
  assertSqlState,
  type Db,
  findPattern,
  findPatternByCode,
  insertEntry,
  MOODS,
  openDatabase,
  PERSONS,
  storedParadigm,
  storedStems,
} from "../harness";

const db = await openDatabase();

const iq = await findPatternByCode(db, "f1-a-i-quadriliteral");
const iiq = await findPatternByCode(db, "f2-quadriliteral");
const iiiq = await findPatternByCode(db, "f3-quadriliteral");
const ivq = await findPatternByCode(db, "f4-quadriliteral");
const soundFormI = await findPattern(db, 1, "a ~ u");
const formII = await findPattern(db, 2, "");

const SOUND_RULES = JSON.stringify({ perfect: "{1}َ{2}َ{3}" });
const QUAD_MASDAR_RULES = JSON.stringify({ masdar: "{1}َ{2}ْ{3}َ{4}َة" });

const conjugationCount = (scope: Db, entryId: number, voice?: "active" | "passive"): Promise<string> =>
  scope.scalar<string>(
    "SELECT count(*)::text FROM conjugation WHERE lexical_entry_id = $1 AND ($2::voice_type IS NULL OR voice = $2::voice_type)",
    [entryId, voice ?? null],
  );

const derivedDigest = (scope: Db, entryId: number): Promise<string> =>
  scope.scalar<string>(
    `SELECT md5(concat_ws('|',
              le.masdar, le.active_participle, le.passive_participle, le.search_vector::text,
              (SELECT string_agg(c.voice || ':' || c.mood || ':' || c.person || ':' || c.form, ',' ORDER BY c.voice, c.mood, c.person)
               FROM conjugation c WHERE c.lexical_entry_id = le.id)))
     FROM lexical_entry le WHERE le.id = $1`,
    [entryId],
  );

test("require_radical_count returns the cleaned root for three and for four radicals", async () => {
  assert.equal(await db.scalar<string>("SELECT require_radical_count($1, 3)", [" ك-ت ب "]), "كتب");
  assert.equal(await db.scalar<string>("SELECT require_radical_count($1, 4)", [" د َ ح-ر ج "]), "دحرج");
});

test("require_radical_count names the expected count and what it found", async () => {
  assertSqlState(
    await db.failure("SELECT require_radical_count($1, 4)", ["كتب"]),
    "22023",
    /root 'كتب' must have exactly 4 radicals after normalization, found 3/,
  );
  assertSqlState(
    await db.failure("SELECT require_radical_count($1, 3)", ["دحرج"]),
    "22023",
    /root 'دحرج' must have exactly 3 radicals after normalization, found 4/,
  );
  assertSqlState(
    await db.failure("SELECT require_radical_count($1, 4)", [null]),
    "22023",
    /root '<NULL>' must have exactly 4 radicals after normalization, found 0/,
  );
});

test("require_radical_count refuses a bare alef in a four-radical root", async () => {
  assertSqlState(
    await db.failure("SELECT require_radical_count($1, 4)", ["طاعم"]),
    "22023",
    /contains alef.*write a weak radical as و or ي/,
  );
});

test("require_triliteral_root is require_radical_count with three and keeps refusing four radicals", async () => {
  assert.equal(await db.scalar<string>("SELECT require_triliteral_root($1)", [" ك-ت ب "]), "كتب");
  assertSqlState(
    await db.failure("SELECT require_triliteral_root($1)", ["دحرج"]),
    "22023",
    /root 'دحرج' must have exactly 3 radicals after normalization, found 4/,
  );
});

test("a rule set that uses the fourth placeholder is quadriliteral, any other is triliteral", async () => {
  const count = (rules: string) => db.scalar<number>("SELECT rules_radical_count($1::jsonb)", [rules]);
  assert.equal(await count(JSON.stringify({ perfect: "{1}َ{2}َ{3}" })), 3);
  assert.equal(await count(JSON.stringify({ masdar: "{1}َ{2}ْ{3}َ{4}َة" })), 4);
  assert.equal(await count(JSON.stringify({ perfect: { first_person_singular: "{4}" } })), 4);
  assert.equal(await count("{}"), 3);
});

test("the quadriliteral forms borrow the imperfect affixes of forms II, V, VII and IX", async () => {
  const borrowed: [form: number, from: number][] = [
    [1, 2],
    [2, 5],
    [3, 7],
    [4, 9],
  ];
  for (const [form, from] of borrowed) {
    assert.equal(await db.scalar<number>("SELECT affix_form_for($1, 4)", [form]), from);
    assert.equal(
      await db.scalar<boolean>("SELECT prepared_affix_rules($1, 4) = prepared_affix_rules($2, 3)", [form, from]),
      true,
      `form ${form}q reads the rows of form ${from}`,
    );
  }
  for (let form = 1; form <= 10; form += 1) {
    assert.equal(await db.scalar<number>("SELECT affix_form_for($1, 3)", [form]), form);
    assert.equal(await db.scalar<number>("SELECT affix_form_for($1)", [form]), form);
  }
});

test("the first person of the imperfect takes the damma prefix in form Iq and the fatha prefix in form IIq", async () => {
  const prefix = (form: number) =>
    db.scalar<string>(
      "SELECT prepared_affix_rules($1, 4) -> 'imperfect_indicative' -> 'third_person_masculine_singular' ->> 0",
      [form],
    );
  assert.equal(await prefix(1), "يُ");
  assert.equal(await prefix(2), "يَ");
  assert.equal(await prefix(3), "يَ");
});

test("replace_root_placeholders fills the fourth placeholder and leaves it when there is no fourth radical", async () => {
  assert.equal(
    await db.scalar<string>("SELECT replace_root_placeholders($1, 'د', 'ح', 'ر', 'ج')", ["{1}{2}{3}{4}"]),
    "دحرج",
  );
  assert.equal(
    await db.scalar<string>("SELECT replace_root_placeholders($1, 'د', 'ح', 'ر')", ["{1}{2}{3}{4}"]),
    "دحر{4}",
  );
  assert.equal(await db.scalar<string>("SELECT replace_root_placeholders($1, 'ك', 'ت', 'ب')", ["{1}{2}{3}"]), "كتب");
  assert.equal(await db.scalar<string>("SELECT replace_root_placeholders($1, 'ك', 'ت', 'ب', 'أ')", ["{4}{3}"]), "ءب");
});

test("the generators take the radical count from the placeholders of the rules", async () => {
  const quadRows = await db.rows<{ person: string; form: string }>(
    `SELECT kv.key AS person, kv.value AS form
     FROM generate_conjugation_rows($1, $2::jsonb, 1) cr, LATERAL jsonb_each_text(cr.person_forms) kv
     WHERE cr.mood = 'perfect' AND kv.key = 'third_person_masculine_singular'`,
    [" ت-رجم ", JSON.stringify({ perfect: "{1}َ{2}ْ{3}َ{4}" })],
  );
  assert.equal(quadRows.length, 1);
  assertArabicEqual(quadRows[0]?.form ?? null, "تَرْجَمَ", "noisy four-letter root");

  const nouns = await db.one<{ masdar: string }>("SELECT masdar FROM generate_verbal_nouns($1, $2::jsonb, 1)", [
    "ترجم",
    QUAD_MASDAR_RULES,
  ]);
  assertArabicEqual(nouns.masdar, "تَرْجَمَة", "masdar of a quadriliteral pattern");
});

test("a quadriliteral rule set refuses a three-letter root and a triliteral one refuses four letters", async () => {
  for (const sql of [
    "SELECT * FROM generate_verbal_nouns($1, $2::jsonb, 1)",
    "SELECT * FROM generate_conjugation_rows($1, $2::jsonb, 1)",
  ]) {
    assertSqlState(
      await db.failure(sql, ["كتب", JSON.stringify({ perfect: "{1}َ{2}َ{3}َ{4}", masdar: "{4}" })]),
      "22023",
      /root 'كتب' must have exactly 4 radicals after normalization, found 3/,
    );
    assertSqlState(
      await db.failure(sql, ["دحرج", SOUND_RULES]),
      "22023",
      /root 'دحرج' must have exactly 3 radicals after normalization, found 4/,
    );
  }
});

test("form IIq prefixes the imperfect with fatha and form Iq with damma in a stored entry", async () => {
  await db.tx(async (tx) => {
    const first = await insertEntry(tx, { text: "دَحْرَجَ", root: "دحرج", morphPatternId: iq.id });
    const second = await insertEntry(tx, { text: "تَدَحْرَجَ", root: "دحرج", morphPatternId: iiq.id });
    const firstParadigm = await storedParadigm(tx, first);
    const secondParadigm = await storedParadigm(tx, second);
    assertArabicEqual(firstParadigm.imperfect_indicative?.third_person_masculine_singular ?? null, "يُدَحْرِجُ");
    assertArabicEqual(secondParadigm.imperfect_indicative?.third_person_masculine_singular ?? null, "يَتَدَحْرَجُ");
  });
});

test("an entry with a quadriliteral pattern and a four-letter root gets the whole paradigm and its verbal nouns", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم", morphPatternId: iq.id });
    assert.equal(await conjugationCount(tx, entryId), "109");
    assert.equal(await conjugationCount(tx, entryId, "passive"), "52");
    const paradigm = await storedParadigm(tx, entryId);
    assert.deepEqual(Object.keys(paradigm).sort(), [...MOODS].sort());
    assert.equal(Object.keys(paradigm.perfect ?? {}).length, PERSONS.length);
    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.masdar, "تَرْجَمَة");
    assertArabicEqual(stems.active_participle, "مُتَرْجِم");
    assertArabicEqual(stems.passive_participle, "مُتَرْجَم");
    assert.equal(stems.latin_root, "trjm");
  });
});

test("the Latin root of a four-letter root is transliterated letter by letter", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "دَحْرَجَ", root: "د ح ر ج" });
    assert.equal((await storedStems(tx, entryId)).latin_root, "dḥrj");
    const hamza = await insertEntry(tx, { text: "طَمْأَنَ", root: "طمأن" });
    assert.equal((await storedStems(tx, hamza)).latin_root, "ṭmʔn");
  });
});

test("a pattern is checked against the radical count of the root it is attached to", async () => {
  await db.tx(async (tx) => {
    const quadOnThree = await tx.failure(
      "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', $1, $2, $3)",
      ["كَتَبَ", "كتب", iq.id],
    );
    assertSqlState(
      quadOnThree,
      "22023",
      /root 'كتب' must have exactly 4 radicals when a morphological pattern is attached, found 3/,
    );

    const threeOnFour = await tx.failure(
      "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', $1, $2, $3)",
      ["تَرْجَمَ", "ترجم", soundFormI.id],
    );
    assertSqlState(
      threeOnFour,
      "22023",
      /root 'ترجم' must have exactly 3 radicals when a morphological pattern is attached, found 4/,
    );
  });
});

test("changing the root or the pattern of an entry keeps the radical count in step", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم", morphPatternId: iq.id });

    assertSqlState(
      await tx.failure("UPDATE lexical_entry SET root = $2 WHERE id = $1", [entryId, "كتب"]),
      "22023",
      /exactly 4 radicals/,
    );
    assertSqlState(
      await tx.failure("UPDATE lexical_entry SET morph_pattern_id = $2 WHERE id = $1", [entryId, soundFormI.id]),
      "22023",
      /exactly 3 radicals/,
    );

    await tx.exec("UPDATE lexical_entry SET root = $2, morph_pattern_id = $3 WHERE id = $1", [
      entryId,
      "كتب",
      soundFormI.id,
    ]);
    assert.equal(await conjugationCount(tx, entryId), "109");
    assertArabicEqual((await storedStems(tx, entryId)).masdar, "كَتْب");

    await tx.exec("UPDATE lexical_entry SET root = $2, morph_pattern_id = $3 WHERE id = $1", [entryId, "دحرج", iiq.id]);
    assert.equal(await conjugationCount(tx, entryId), "57");
    assertArabicEqual((await storedStems(tx, entryId)).masdar, "تَدَحْرُج");
  });
});

test("a four-letter root without a pattern is stored and carries no derived data", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم" });
    assert.equal(await conjugationCount(tx, entryId), "0");
    assert.equal((await storedStems(tx, entryId)).masdar, null);
    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = $2 WHERE id = $1", [entryId, ivq.id]);
    assert.equal(await conjugationCount(tx, entryId), "57");
    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = NULL WHERE id = $1", [entryId]);
    assert.equal(await conjugationCount(tx, entryId), "0");
    assert.equal((await storedStems(tx, entryId)).masdar, null);
  });
});

test("every regeneration path leaves the same derived data for triliteral and quadriliteral entries", async () => {
  await db.tx(async (tx) => {
    const entries = [
      await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id }),
      await insertEntry(tx, { text: "قَدَّمَ", root: "قدم", morphPatternId: formII.id }),
      await insertEntry(tx, { text: "دَحْرَجَ", root: "دحرج", morphPatternId: iq.id }),
      await insertEntry(tx, { text: "تَدَحْرَجَ", root: "دحرج", morphPatternId: iiq.id }),
      await insertEntry(tx, { text: "اِحْرَنْجَمَ", root: "حرجم", morphPatternId: iiiq.id }),
      await insertEntry(tx, { text: "اِقْشَعَرَّ", root: "قشعر", morphPatternId: ivq.id }),
    ];
    const before = await Promise.all(entries.map((id) => derivedDigest(tx, id)));

    await tx.exec("SELECT regenerate_all_derived_stems()");
    assert.deepEqual(await Promise.all(entries.map((id) => derivedDigest(tx, id))), before, "full regeneration");

    for (const id of entries) {
      await tx.exec("SELECT regenerate_derived_stems_for_entry($1)", [id]);
    }
    assert.deepEqual(await Promise.all(entries.map((id) => derivedDigest(tx, id))), before, "entry by entry");

    await tx.exec("DELETE FROM conjugation");
    await tx.exec("UPDATE lexical_entry SET masdar = NULL, active_participle = NULL, passive_participle = NULL");
    await tx.exec("SELECT regenerate_derived_stems($1::int[])", [`{${entries.join(",")}}`]);
    assert.deepEqual(await Promise.all(entries.map((id) => derivedDigest(tx, id))), before, "rebuilt from nothing");
  });
});

test("editing a quadriliteral pattern regenerates the entries that use it, only for what changed", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم", morphPatternId: iq.id });
    const before = await storedParadigm(tx, entryId);

    await tx.exec(
      `UPDATE morph_pattern SET rules = jsonb_set(rules, '{masdar}', to_jsonb('{1}َ{2}ْ{3}ِ{4}ٌ'::text)) WHERE id = $1`,
      [iq.id],
    );
    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.masdar, "تَرْجِمٌ", "verbal noun template edit");
    assertParadigmEqual(
      (await storedParadigm(tx, entryId)).perfect ?? {},
      before.perfect ?? {},
      "a noun edit leaves the conjugation alone",
    );

    await tx.exec(
      `UPDATE morph_pattern SET rules = jsonb_set(rules, '{perfect}', to_jsonb('{1}َ{2}ْ{3}ُ{4}'::text)) WHERE id = $1`,
      [iq.id],
    );
    const after = await storedParadigm(tx, entryId);
    assertArabicEqual(after.perfect?.third_person_masculine_singular ?? null, "تَرْجُمَ", "perfect template edit");
  });
});

test("editing the passive rules of a quadriliteral pattern regenerates the passive rows of its entries and removing them deletes the rows", async () => {
  const passivePerfect = (scope: Db, entryId: number) =>
    scope.scalar<string | null>(
      `SELECT form FROM conjugation
       WHERE lexical_entry_id = $1 AND voice = 'passive' AND mood = 'perfect'
         AND person = 'third_person_masculine_singular'`,
      [entryId],
    );
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم", morphPatternId: iq.id });
    assertArabicEqual(await passivePerfect(tx, entryId), "تُرْجِمَ");

    await tx.exec(
      `UPDATE morph_pattern SET rules = jsonb_set(rules, '{passive_perfect}', to_jsonb('{1}ُ{2}ْ{3}ُ{4}'::text)) WHERE id = $1`,
      [iq.id],
    );
    assertArabicEqual(await passivePerfect(tx, entryId), "تُرْجُمَ");
    assert.equal(await conjugationCount(tx, entryId, "passive"), "52");

    await tx.exec(
      "UPDATE morph_pattern SET rules = rules - 'passive_perfect' - 'passive_imperfect_stem' WHERE id = $1",
      [iq.id],
    );
    assert.equal(await conjugationCount(tx, entryId, "passive"), "0");
    assert.equal(await conjugationCount(tx, entryId, "active"), "57");
  });
});

test("an entry of the first quadriliteral form that has no passive keeps its active rows and stores no passive row", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "عَرْبَدَ",
      root: "عربد",
      morphPatternId: iq.id,
      overrides: { no_passive: true },
    });
    assert.equal(await conjugationCount(tx, entryId, "passive"), "0");
    assert.equal(await conjugationCount(tx, entryId, "active"), "57");
    assert.equal((await storedStems(tx, entryId)).passive_participle, null);
  });
});

test("the resolver reads the radical count from its fifth argument and defaults to three", async () => {
  const resolved = (root: string, form: number, perfect: string | null, imperfect: string | null, count?: number) =>
    db.scalar<number | null>(
      count === undefined
        ? "SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)"
        : "SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int)",
      count === undefined ? [root, form, perfect, imperfect] : [root, form, perfect, imperfect, count],
    );
  assert.equal(await resolved("ترجم", 1, "a", "i", 4), iq.id);
  assert.equal(await resolved("ترجم", 2, null, null, 4), iiq.id);
  assert.equal(await resolved("حرجم", 3, null, null, 4), iiiq.id);
  assert.equal(await resolved("قشعر", 4, null, null, 4), ivq.id);
  assert.equal(await resolved("كتب", 1, "a", "i"), (await findPatternByCode(db, "f1-a-i")).id);
  assert.equal(await resolved("كتب", 2, null, null, 3), formII.id);
  assert.equal(await resolved("كتب", 1, "a", "u", 3), soundFormI.id);
});

test("a root of the wrong length for the requested radical count is refused with the expected count", async () => {
  const failure = (root: string, count?: number) =>
    db.failure(
      count === undefined
        ? "SELECT resolve_morph_pattern_id($1, 2, NULL, NULL)"
        : "SELECT resolve_morph_pattern_id($1, 2, NULL, NULL, $2::int)",
      count === undefined ? [root] : [root, count],
    );
  assertSqlState(
    await failure("ترجم"),
    "22023",
    /root 'ترجم' must have exactly 3 radicals after normalization, found 4/,
  );
  assertSqlState(
    await failure("كتب", 4),
    "22023",
    /root 'كتب' must have exactly 4 radicals after normalization, found 3/,
  );
  assertSqlState(await failure("ترجم", 3), "22023", /exactly 3 radicals/);
  assertSqlState(await failure("ترجم", 5), "22023", /a verb root has 3 or 4 radicals, got 5/);
});

test("argument validation runs before the root is looked at, for both radical counts", async () => {
  assertSqlState(
    await db.failure("SELECT resolve_morph_pattern_id($1, 1, NULL, NULL, 4)", ["كتب"]),
    "22023",
    /form I requires both a perfect and an imperfect vowel/,
  );
  assertSqlState(
    await db.failure("SELECT resolve_morph_pattern_id($1, 2, 'a', NULL, 4)", ["كتب"]),
    "22023",
    /vowels only apply to form I, got form 2/,
  );
});

test("a root whose last radical is weak resolves to no sound quadriliteral pattern", async () => {
  const unresolved: [root: string, forms: number[]][] = [
    ["سلقي", [1, 2, 4]],
    ["سلقى", [1, 2, 4]],
    ["غردي", [1, 2, 4]],
    ["سردي", [1, 2, 4]],
    ["سلقو", [1, 2, 3, 4]],
    ["غردو", [1, 2, 3, 4]],
  ];
  for (const [root, forms] of unresolved) {
    for (const form of forms) {
      assert.equal(
        await db.scalar<number | null>(
          "SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, 4)",
          [root, form, form === 1 ? "a" : null, form === 1 ? "i" : null],
        ),
        null,
        `${root} form ${form}q`,
      );
    }
  }
});

test("a weak letter anywhere before the last radical is a consonant and still resolves", async () => {
  for (const root of ["سيطر", "هرول", "وسوس", "حوقل", "أسلم", "طمأن", "يلمع"]) {
    assert.equal(
      await db.scalar<number | null>("SELECT resolve_morph_pattern_id($1, 2, NULL, NULL, 4)", [root]),
      iiq.id,
      root,
    );
  }
});

test("an override is matched to the radical count of its pattern", async () => {
  await db.tx(async (tx) => {
    const lexicalId = await tx.scalar<number>(
      `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical,
                                  perfect_vowel, imperfect_vowel)
       VALUES ('f1-u-i-test-only-quadriliteral', 1, 4, 'فُعْلِلَ', 'test only quadriliteral lexical',
               '{"perfect": "{1}ُ{2}ْ{3}ُ{4}"}'::jsonb, TRUE, 'u', 'i')
       RETURNING id`,
    );
    await tx.exec(
      "INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id) VALUES ('سلقي', 1, 'u', 'i', $1)",
      [lexicalId],
    );
    assert.equal(
      await tx.scalar<number | null>("SELECT resolve_morph_pattern_id('سلقي', 1, 'u', 'i', 4)"),
      lexicalId,
      "the override wins even though the last radical is weak",
    );
    assert.equal(
      await tx.scalar<number | null>("SELECT resolve_morph_pattern_id('سلقي', 1, 'a', 'i', 4)"),
      null,
      "an override applies only to its own form and vowels",
    );
    assertSqlState(
      await tx.failure("SELECT resolve_morph_pattern_id('سلقي', 1, 'u', 'i', 3)"),
      "22023",
      /exactly 3 radicals/,
    );

    await tx.exec("INSERT INTO lexical_pattern_override (root, form_number, morph_pattern_id) VALUES ('سلق', 2, $1)", [
      iiq.id,
    ]);
    assert.equal(
      await tx.scalar<number | null>("SELECT resolve_morph_pattern_id('سلق', 2, NULL, NULL, 3)"),
      formII.id,
      "a triliteral lookup never returns a quadriliteral pattern",
    );
  });
});

test("describe_quadriliteral_root names what is special about the root", async () => {
  const labels = (root: string) => db.scalar<string[]>("SELECT describe_quadriliteral_root($1)", [root]);
  assert.deepEqual(await labels("دحرج"), ["quadriliteral"]);
  assert.deepEqual(await labels("زلزل"), ["quadriliteral", "reduplicated"]);
  assert.deepEqual(await labels("هرول"), ["quadriliteral"]);
  assert.deepEqual(await labels("أسلم"), ["quadriliteral", "hamzated"]);
  assert.deepEqual(await labels("طأطأ"), ["quadriliteral", "hamzated", "reduplicated"]);
  assert.deepEqual(await labels("سلقى"), ["quadriliteral", "final-weak"]);
  assertSqlState(await db.failure("SELECT describe_quadriliteral_root($1)", ["كتب"]), "22023", /exactly 4 radicals/);
});

test("classify_root keeps refusing four radicals, which the quadriliteral flow does not use", async () => {
  assertSqlState(
    await db.failure("SELECT classify_root($1)", ["دحرج"]),
    "22023",
    /must have exactly 3 radicals after normalization, found 4/,
  );
});

test("the quadriliteral patterns resolve one shape each, keyed by radical count", async () => {
  const rows = await db.rows<{ code: string; radical_count: number; resolutions: number }>(
    `SELECT mp.code, mp.radical_count,
            (SELECT count(*)::int FROM morph_pattern_resolution r
             WHERE r.morph_pattern_id = mp.id AND r.radical_count = 4) AS resolutions
     FROM morph_pattern mp WHERE mp.radical_count = 4 ORDER BY mp.form_number, mp.id`,
  );
  assert.deepEqual(
    rows.map((row) => [row.code, row.radical_count, row.resolutions]),
    [
      ["f1-a-i-quadriliteral", 4, 1],
      ["f2-quadriliteral", 4, 1],
      ["f3-quadriliteral", 4, 1],
      ["f3-quadriliteral-final-weak", 4, 1],
      ["f4-quadriliteral", 4, 1],
    ],
  );
});

test("two patterns of different radical counts may share form, vowels and shape, two of one count may not", async () => {
  await db.tx(async (tx) => {
    const failure = await tx.failure(
      `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules)
       VALUES ('f2-test-only-duplicate', 2, 4, 'x', 'test only duplicate', '{"perfect": "{4}"}'::jsonb)`,
    );
    assertSqlState(failure, "23505", /unique_morph_pattern_resolution_key/);
  });
  await db.tx(async (tx) => {
    const failure = await tx.failure(
      `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules)
       VALUES ('f2-test-only-triliteral', 2, 3, 'x', 'test only triliteral', '{"perfect": "{1}"}'::jsonb)`,
    );
    assertSqlState(failure, "23505", /unique_morph_pattern_resolution_key/);
  });
});

test("add_morph_pattern_resolution accepts a four-letter example for a quadriliteral pattern only", async () => {
  const existing = await db.scalar<number>(
    "SELECT id FROM morph_pattern_resolution WHERE morph_pattern_id = $1 AND radical_count = 4",
    [iq.id],
  );
  assert.equal(await db.scalar<number>("SELECT add_morph_pattern_resolution($1, $2)", [iq.code, "ترجم"]), existing);
  assertSqlState(
    await db.failure("SELECT add_morph_pattern_resolution($1, $2)", [iq.code, "كتب"]),
    "22023",
    /exactly 4 radicals/,
  );
  assertSqlState(
    await db.failure("SELECT add_morph_pattern_resolution($1, $2)", ["f2", "ترجم"]),
    "22023",
    /exactly 3 radicals/,
  );
});

test("the table checks tie the radical count to the rules and keep a quadriliteral pattern sound", async () => {
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical,
                                   perfect_vowel, imperfect_vowel)
         VALUES ('f1-test-only-five', 1, 5, 'x', 'test only five', '{"perfect": "{1}"}'::jsonb, TRUE, 'u', 'i')`,
      ),
      "23514",
      /chk_morph_pattern_radical_count/,
    );
  });
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical,
                                   perfect_vowel, imperfect_vowel)
         VALUES ('f1-test-only-bare', 1, 4, 'x', 'test only bare', '{"perfect": "{1}"}'::jsonb, TRUE, 'u', 'i')`,
      ),
      "23514",
      /chk_morph_pattern_radical_count_rules/,
    );
  });
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical,
                                   perfect_vowel, imperfect_vowel)
         VALUES ('f1-test-only-extra', 1, 3, 'x', 'test only extra', '{"perfect": "{4}"}'::jsonb, TRUE, 'u', 'i')`,
      ),
      "23514",
      /chk_morph_pattern_radical_count_rules/,
    );
  });
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical,
                                 radical2_kind, perfect_vowel, imperfect_vowel)
       VALUES ('f1-test-only-waw', 1, 4, 'x', 'test only waw', '{"perfect": "{4}"}'::jsonb, TRUE, 'waw', 'u', 'i')`,
      ),
      "23514",
      /chk_morph_pattern_quadriliteral_shape/,
    );
  });
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical,
                                 is_geminate, perfect_vowel, imperfect_vowel)
       VALUES ('f1-test-only-gem', 1, 4, 'x', 'test only gem', '{"perfect": "{4}"}'::jsonb, TRUE, TRUE, 'u', 'i')`,
      ),
      "23514",
      /chk_morph_pattern_quadriliteral_shape/,
    );
  });
});

test("moving a pattern to another radical count moves its resolution row with it", async () => {
  await db.tx(async (tx) => {
    const id = await tx.scalar<number>(
      `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, perfect_vowel,
                                  imperfect_vowel)
       VALUES ('f1-u-i-test-only-move', 1, 3, 'x', 'test only move', '{"perfect": "{1}"}'::jsonb, 'u', 'i')
       RETURNING id`,
    );
    const counts = () =>
      tx.rows<{ radical_count: number }>(
        "SELECT radical_count FROM morph_pattern_resolution WHERE morph_pattern_id = $1",
        [id],
      );
    assert.deepEqual(await counts(), [{ radical_count: 3 }]);
    await tx.exec(`UPDATE morph_pattern SET radical_count = 4, rules = '{"perfect": "{4}"}'::jsonb WHERE id = $1`, [
      id,
    ]);
    assert.deepEqual(await counts(), [{ radical_count: 4 }]);
    assert.equal(await tx.scalar<number | null>("SELECT resolve_morph_pattern_id('كتبم', 1, 'u', 'i', 4)"), id);
    assert.equal(await tx.scalar<number | null>("SELECT resolve_morph_pattern_id('كتب', 1, 'u', 'i')"), null);
  });
});
