import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  assertParadigmEqual,
  assertSqlState,
  conjugate,
  type Db,
  findPatternByCode,
  insertEntry,
  openDatabase,
  type Paradigm,
  storedParadigm,
  storedStems,
  verbalNouns,
} from "../harness";
import { INTERROGATE_FIXTURE } from "./variants-data.ts";

const db = await openDatabase();

const RESPOND = "اِسْتَجَابَ";
const INTERROGATE = "اِسْتَجْوَبَ";
const ROOT = "جوب";

interface VariantRow {
  morph_pattern_id: number;
  code: string;
  variant: string | null;
  note: string | null;
  is_default: boolean;
  sample: string | null;
}

const variants = (
  scope: Db,
  root: string,
  formNumber: number,
  perfect: string | null = null,
  imperfect: string | null = null,
): Promise<VariantRow[]> =>
  scope.rows<VariantRow>(
    `SELECT morph_pattern_id, code, variant, note, is_default, sample
     FROM morph_pattern_variants($1, $2::int, $3::short_vowel, $4::short_vowel)`,
    [root, formNumber, perfect, imperfect],
  );

const resolve = (
  scope: Db,
  root: string,
  formNumber: number,
  perfect: string | null = null,
  imperfect: string | null = null,
): Promise<number | null> =>
  scope.scalar<number | null>("SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)", [
    root,
    formNumber,
    perfect,
    imperfect,
  ]);

const allowed = (
  scope: Db,
  root: string,
  formNumber: number,
  patternId: number,
  perfect: string | null = null,
  imperfect: string | null = null,
): Promise<boolean> =>
  scope.scalar<boolean>("SELECT morph_pattern_choice_allowed($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int)", [
    root,
    formNumber,
    perfect,
    imperfect,
    patternId,
  ]);

const insertLexicalPattern = (scope: Db, code: string, formNumber: number, vowels: [string, string] | null) =>
  scope.scalar<number>(
    `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical,
                                radical1_kind, radical2_kind, radical3_kind, is_geminate,
                                perfect_vowel, imperfect_vowel)
     SELECT $1, $2::int, vocalic_template, 'test only, ' || $1, rules, TRUE,
            radical1_kind, radical2_kind, radical3_kind, is_geminate,
            $3::short_vowel, $4::short_vowel
     FROM morph_pattern WHERE code = $5
     RETURNING id`,
    [code, formNumber, vowels?.[0], vowels?.[1], formNumber === 1 ? "f1-a-u" : `f${formNumber}`],
  );

const insertOverride = (
  scope: Db,
  input: {
    root: string;
    formNumber: number;
    perfect?: string | null;
    imperfect?: string | null;
    variant?: string | null;
    patternId: number;
  },
) =>
  scope.scalar<number>(
    `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, variant, morph_pattern_id)
     VALUES ($1, $2::int, $3::short_vowel, $4::short_vowel, $5, $6)
     RETURNING id`,
    [
      input.root,
      input.formNumber,
      input.perfect ?? null,
      input.imperfect ?? null,
      input.variant ?? null,
      input.patternId,
    ],
  );

test("root jwb in form X offers the hollow verb first and the strong verb as the variant interrogate", async () => {
  const hollow = await findPatternByCode(db, "f10-hollow-waw");
  const strong = await findPatternByCode(db, "f10-hollow-strong-inflection");
  const rows = await variants(db, ROOT, 10);
  assert.deepEqual(
    rows.map((row) => [row.morph_pattern_id, row.code, row.variant, row.is_default]),
    [
      [hollow.id, "f10-hollow-waw", null, true],
      [strong.id, "f10-hollow-strong-inflection", "interrogate", false],
    ],
  );
  assertArabicEqual(rows[0]?.sample ?? null, RESPOND, "sample of the default");
  assertArabicEqual(rows[1]?.sample ?? null, INTERROGATE, "sample of the variant");
  assert.match(rows[1]?.note ?? "", /§163/);
  assert.equal(await resolve(db, ROOT, 10), hollow.id);
});

test("only variants of the same root, form and vowels are offered", async () => {
  assert.equal((await variants(db, "كتب", 10)).length, 1);
  assert.equal((await variants(db, "قوم", 10)).length, 1);
  assert.equal((await variants(db, ROOT, 9)).length, 1);
  assert.equal((await variants(db, ROOT, 4)).length, 1);
  assert.equal((await variants(db, ROOT, 1, "a", "u")).length, 1);
  assert.equal((await variants(db, "حوذ", 10)).length, 1);
  assert.equal(
    (await variants(db, "حوذ", 10)).map((row) => row.code).join(),
    "f10-hollow-strong-inflection",
    "a default override is the resolved pattern and not a variant",
  );
});

test("a root typed with noise or a hamza letter finds the variants of its canonical spelling", async () => {
  await db.tx(async (tx) => {
    const pattern = await insertLexicalPattern(tx, "f1-u-i-test-variant", 1, ["u", "i"]);
    await insertOverride(tx, {
      root: "سأل",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "second",
      patternId: pattern,
    });
    for (const typed of ["سأل", "سءل", "سإل", "سؤل", "سئل", "سَأَلَ", "س ء ل"]) {
      const rows = await variants(tx, typed, 1, "u", "i");
      assert.deepEqual(
        rows.map((row) => row.variant),
        ["second"],
        typed,
      );
    }
  });
});

test("the unique key includes the variant, and a missing variant is still unique", async () => {
  await db.tx(async (tx) => {
    const first = await insertLexicalPattern(tx, "f1-u-i-test-first", 1, ["u", "i"]);
    const second = await insertLexicalPattern(tx, "f1-u-i-test-second", 1, ["u", "i"]);
    await insertOverride(tx, { root: "ثبت", formNumber: 1, perfect: "u", imperfect: "i", patternId: first });
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "alpha",
      patternId: second,
    });
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "beta",
      patternId: second,
    });

    const duplicateDefault = await tx.failure(
      `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id)
       VALUES ('ثبت', 1, 'u', 'i', $1)`,
      [second],
    );
    assertSqlState(duplicateDefault, "23505", /unique_lexical_pattern_override_key/);

    const duplicateVariant = await tx.failure(
      `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, variant, morph_pattern_id)
       VALUES ('ثبت', 1, 'u', 'i', 'alpha', $1)`,
      [first],
    );
    assertSqlState(duplicateVariant, "23505", /unique_lexical_pattern_override_key/);
  });
});

test("an override without a variant keeps resolving, whatever variants exist beside it", async () => {
  await db.tx(async (tx) => {
    const first = await insertLexicalPattern(tx, "f1-u-i-test-first", 1, ["u", "i"]);
    const second = await insertLexicalPattern(tx, "f1-u-i-test-second", 1, ["u", "i"]);
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "alpha",
      patternId: second,
    });
    assert.equal(await resolve(tx, "ثبت", 1, "u", "i"), null, "a variant alone never becomes the default");
    await insertOverride(tx, { root: "ثبت", formNumber: 1, perfect: "u", imperfect: "i", patternId: first });
    assert.equal(
      await resolve(tx, "ثبت", 1, "u", "i"),
      first,
      "the default row wins although the variant row has the lower id",
    );
    const rows = await variants(tx, "ثبت", 1, "u", "i");
    assert.deepEqual(
      rows.map((row) => [row.morph_pattern_id, row.variant, row.is_default]),
      [
        [first, null, true],
        [second, "alpha", false],
      ],
    );
  });

  const eur = await findPatternByCode(db, "f1-i-a-hollow-waw-strong-inflection");
  assert.equal(await resolve(db, "عور", 1, "i", "a"), eur.id);
  assert.equal((await variants(db, "عور", 1, "i", "a")).length, 1);
});

test("a variant that names the resolved pattern is not offered a second time", async () => {
  await db.tx(async (tx) => {
    const pattern = await insertLexicalPattern(tx, "f1-u-i-test-same", 1, ["u", "i"]);
    await insertOverride(tx, { root: "ثبت", formNumber: 1, perfect: "u", imperfect: "i", patternId: pattern });
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "same",
      patternId: pattern,
    });
    const rows = await variants(tx, "ثبت", 1, "u", "i");
    assert.deepEqual(
      rows.map((row) => [row.morph_pattern_id, row.variant]),
      [[pattern, null]],
    );
  });
});

test("several variants are listed after the default in name order", async () => {
  await db.tx(async (tx) => {
    const first = await insertLexicalPattern(tx, "f1-u-i-test-first", 1, ["u", "i"]);
    const second = await insertLexicalPattern(tx, "f1-u-i-test-second", 1, ["u", "i"]);
    const third = await insertLexicalPattern(tx, "f1-u-i-test-third", 1, ["u", "i"]);
    await insertOverride(tx, { root: "ثبت", formNumber: 1, perfect: "u", imperfect: "i", patternId: first });
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "zeta",
      patternId: third,
    });
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "alpha",
      patternId: second,
    });
    assert.deepEqual(
      (await variants(tx, "ثبت", 1, "u", "i")).map((row) => row.variant),
      [null, "alpha", "zeta"],
    );
  });
});

test("a choice is allowed only for the resolved pattern and the variants of that root, form and vowels", async () => {
  const hollow = await findPatternByCode(db, "f10-hollow-waw");
  const strong = await findPatternByCode(db, "f10-hollow-strong-inflection");
  const unrelated = await findPatternByCode(db, "f1-a-u");
  const otherForm = await findPatternByCode(db, "f9");
  assert.equal(await allowed(db, ROOT, 10, hollow.id), true);
  assert.equal(await allowed(db, ROOT, 10, strong.id), true);
  assert.equal(await allowed(db, ROOT, 10, unrelated.id), false);
  assert.equal(await allowed(db, ROOT, 10, otherForm.id), false);
  assert.equal(await allowed(db, ROOT, 10, 987654), false);
  assert.equal(await allowed(db, "كتب", 10, strong.id), false, "a variant of another root is refused");
  assert.equal(await allowed(db, ROOT, 9, strong.id), false, "a variant of another form is refused");
  assert.equal(await allowed(db, "كتب", 10, (await findPatternByCode(db, "f10")).id), true);
});

test("a variant must name a lexical pattern of its own form and vowels", async () => {
  await db.tx(async (tx) => {
    const shape = await findPatternByCode(tx, "f10-hollow-waw");
    const nonLexical = await tx.failure(
      `INSERT INTO lexical_pattern_override (root, form_number, variant, morph_pattern_id)
       VALUES ('ثبت', 10, 'plain', $1)`,
      [shape.id],
    );
    assertSqlState(nonLexical, "23514", /not lexical/);
  });
  await db.tx(async (tx) => {
    const strong = await findPatternByCode(tx, "f10-hollow-strong-inflection");
    const wrongForm = await tx.failure(
      `INSERT INTO lexical_pattern_override (root, form_number, variant, morph_pattern_id)
       VALUES ('ثبت', 9, 'plain', $1)`,
      [strong.id],
    );
    assertSqlState(wrongForm, "23514", /form and vowels/);
  });
  await db.tx(async (tx) => {
    const pattern = await insertLexicalPattern(tx, "f1-u-i-test-vowels", 1, ["u", "i"]);
    const wrongVowels = await tx.failure(
      `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, variant, morph_pattern_id)
       VALUES ('ثبت', 1, 'u', 'u', 'plain', $1)`,
      [pattern],
    );
    assertSqlState(wrongVowels, "23514", /form and vowels/);
  });
  await db.tx(async (tx) => {
    const strong = await findPatternByCode(tx, "f10-hollow-strong-inflection");
    const id = await insertOverride(tx, { root: "ثبت", formNumber: 10, variant: "ok", patternId: strong.id });
    const repoint = await tx.failure("UPDATE lexical_pattern_override SET morph_pattern_id = $1 WHERE id = $2", [
      (await findPatternByCode(tx, "f10-hollow-waw")).id,
      id,
    ]);
    assertSqlState(repoint, "23514", /not lexical/);
  });
});

test("a variant name is a short lower-case slug, and an existing override without one needs none", async () => {
  const strong = await findPatternByCode(db, "f10-hollow-strong-inflection");
  for (const valid of ["interrogate", "a", "x1", "two-words", "a-1-b", "a".repeat(40)]) {
    await db.tx(async (tx) => {
      await insertOverride(tx, { root: "ثبت", formNumber: 10, variant: valid, patternId: strong.id });
    });
  }
  for (const invalid of [
    "",
    "Interrogate",
    "two words",
    "-lead",
    "trail-",
    "double--dash",
    "1abc",
    "عربي",
    "a".repeat(41),
  ]) {
    await db.tx(async (tx) => {
      const failure = await tx.failure(
        `INSERT INTO lexical_pattern_override (root, form_number, variant, morph_pattern_id)
         VALUES ('ثبت', 10, $1, $2)`,
        [invalid, strong.id],
      );
      assertSqlState(failure, "23514", /chk_lexical_pattern_override_variant/);
    });
  }
  const unchanged = await db.scalar<number>(
    "SELECT count(*)::int FROM lexical_pattern_override WHERE variant IS NULL AND root = $1",
    ["حوذ"],
  );
  assert.equal(unchanged, 1);
});

test("an invalid root is refused with the same error the resolver gives", async () => {
  const failure = await db.failure("SELECT * FROM morph_pattern_variants('ab', 10)");
  assertSqlState(failure, "22023");
  const noVowels = await db.failure("SELECT * FROM morph_pattern_variants($1, 1)", [ROOT]);
  assertSqlState(noVowels, "22023");
});

test("a root with no default and one variant lists only the variant", async () => {
  await db.tx(async (tx) => {
    const pattern = await insertLexicalPattern(tx, "f1-u-i-test-alone", 1, ["u", "i"]);
    await insertOverride(tx, {
      root: "ثبت",
      formNumber: 1,
      perfect: "u",
      imperfect: "i",
      variant: "only",
      patternId: pattern,
    });
    const rows = await variants(tx, "ثبت", 1, "u", "i");
    assert.deepEqual(
      rows.map((row) => [row.variant, row.is_default]),
      [["only", false]],
    );
  });
});

test("entries of one root and form conjugate as their own verb, the hollow one and the strong one", async () => {
  const hollow = await findPatternByCode(db, "f10-hollow-waw");
  const strong = await findPatternByCode(db, "f10-hollow-strong-inflection");
  await db.tx(async (tx) => {
    const respondId = await insertEntry(tx, { text: RESPOND, root: ROOT, morphPatternId: hollow.id });
    const interrogateId = await insertEntry(tx, { text: INTERROGATE, root: ROOT, morphPatternId: strong.id });

    const interrogate = await storedParadigm(tx, interrogateId);
    const cells = (paradigm: Paradigm) =>
      Object.fromEntries(
        Object.entries(paradigm).flatMap(([mood, persons]) =>
          Object.entries(persons ?? {}).map(([person, form]) => [`${mood} ${person}`, form ?? ""]),
        ),
      );
    const expected: Paradigm = {
      perfect: INTERROGATE_FIXTURE.perfect,
      imperfect_indicative: INTERROGATE_FIXTURE.imperfectIndicative,
      imperfect_subjunctive: INTERROGATE_FIXTURE.imperfectSubjunctive,
      imperfect_jussive: INTERROGATE_FIXTURE.imperfectJussive,
      imperative: INTERROGATE_FIXTURE.imperative,
    };
    assertParadigmEqual(cells(interrogate), cells(expected), INTERROGATE_FIXTURE.id);
    assertParadigmEqual(cells(await conjugate(tx, ROOT, strong.id)), cells(expected), "pattern preview");

    const respond = await storedParadigm(tx, respondId);
    assertArabicEqual(respond.perfect?.third_person_masculine_singular ?? null, RESPOND, "respond perfect");
    assertArabicEqual(
      respond.imperfect_indicative?.third_person_masculine_singular ?? null,
      "يَسْتَجِيبُ",
      "respond imperfect",
    );

    const stems = await storedStems(tx, interrogateId);
    assertArabicEqual(stems.masdar, INTERROGATE_FIXTURE.masdar, "masdar");
    assertArabicEqual(stems.active_participle, INTERROGATE_FIXTURE.activeParticiple, "active participle");
    assertArabicEqual(stems.passive_participle, INTERROGATE_FIXTURE.passiveParticiple, "passive participle");
    const respondStems = await storedStems(tx, respondId);
    assertArabicEqual(respondStems.masdar, "اِسْتِجَابَة", "respond masdar");

    const direct = await verbalNouns(tx, ROOT, strong.id);
    assert.equal(direct.masdar, INTERROGATE_FIXTURE.masdar);
  });
});

test("every variant row in the shipped data satisfies the same rules the trigger enforces", async () => {
  const stray = await db.rows<{ id: number; root: string; variant: string }>(
    `SELECT o.id, o.root, o.variant
     FROM lexical_pattern_override o JOIN morph_pattern p ON p.id = o.morph_pattern_id
     WHERE o.variant IS NOT NULL
       AND (NOT p.is_lexical
            OR p.form_number <> o.form_number
            OR p.perfect_vowel IS DISTINCT FROM o.perfect_vowel
            OR p.imperfect_vowel IS DISTINCT FROM o.imperfect_vowel)`,
  );
  assert.deepEqual(stray, []);
  const shipped = await db.rows<{ root: string; form_number: number; variant: string; code: string }>(
    `SELECT o.root, o.form_number, o.variant, p.code
     FROM lexical_pattern_override o JOIN morph_pattern p ON p.id = o.morph_pattern_id
     WHERE o.variant IS NOT NULL ORDER BY o.root, o.form_number, o.variant`,
  );
  assert.deepEqual(shipped, [
    { root: ROOT, form_number: 10, variant: "interrogate", code: "f10-hollow-strong-inflection" },
  ]);
});
