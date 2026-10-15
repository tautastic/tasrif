import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVerbFormChoice, verbFormChoices } from "~/lib/validation/verbFormChoice";
import { ROOT_SAMPLES } from "../fixtures/roots.ts";
import { assertSqlState, type Db, findPatternByCode, openDatabase } from "../harness";

const db = await openDatabase();

const SEEDED_PATTERNS: [code: string, formNumber: number, description: string][] = [
  ["f1-a-u", 1, "a ~ u"],
  ["f1-a-a", 1, "a ~ a"],
  ["f1-a-i", 1, "a ~ i"],
  ["f1-i-i", 1, "i ~ i"],
  ["f1-i-a", 1, "i ~ a"],
  ["f1-u-u", 1, "u ~ u"],
  ["f1-a-u-hollow-waw", 1, "a ~ u, hollow waw"],
  ["f1-a-i-hollow-ya", 1, "a ~ i, hollow ya"],
  ["f1-a-a-final-weak", 1, "a ~ a, final-weak"],
  ["f1-a-a-final-weak-hamzated-middle", 1, "a ~ a, final-weak, hamzated middle"],
  ["f1-a-a-final-weak-hamzated-middle-hamza-elided", 1, "a ~ a, final-weak, hamzated middle, hamza elided"],
  ["f1-a-i-geminate", 1, "a ~ i, geminate"],
  ["f2", 2, ""],
  ["f3", 3, ""],
  ["f4", 4, ""],
  ["f4-final-weak-ya", 4, "final-weak ya"],
  ["f4-final-weak-waw", 4, "final-weak waw"],
  ["f5", 5, ""],
  ["f6", 6, ""],
  ["f7", 7, ""],
  ["f8", 8, ""],
  ["f8-final-weak-ya", 8, "final-weak ya"],
  ["f8-final-weak-waw", 8, "final-weak waw"],
  ["f9", 9, ""],
  ["f10", 10, ""],
  ["f10-final-weak-ya", 10, "final-weak ya"],
  ["f10-final-weak-waw", 10, "final-weak waw"],
  ["f10-hollow-waw", 10, "hollow waw"],
];

const NON_BREAKING_HYPHEN = "‑";

const DERIVED_CODES: [
  formNumber: number,
  perfect: string | null,
  imperfect: string | null,
  description: string,
  code: string,
][] = [
  [1, "a", "u", "a ~ u", "f1-a-u"],
  [1, "a", "u", "a ~ u, hollow waw", "f1-a-u-hollow-waw"],
  [1, "a", "a", "a ~ a, final-weak, hamzated middle, hamza elided", "f1-a-a-final-weak-hamzated-middle-hamza-elided"],
  [1, "a", "u", "hollow waw", "f1-a-u-hollow-waw"],
  [1, "a", "u", "a ~ i, odd", "f1-a-u-a-i-odd"],
  [1, "a", "i", "Assimilated  WAW (wa3ada)", "f1-a-i-assimilated-waw-wa-ada"],
  [2, null, null, "", "f2"],
  [3, null, null, "  --  ", "f3"],
  [8, null, null, "final-weak ya", "f8-final-weak-ya"],
  [8, null, null, `final${NON_BREAKING_HYPHEN}weak ya`, "f8-final-weak-ya"],
  [10, null, null, "وزن خاص", "f10"],
];

const derivedCode = (formNumber: number, perfect: string | null, imperfect: string | null, description: string) =>
  db.scalar<string>("SELECT morph_pattern_code($1::int, $2::short_vowel, $3::short_vowel, $4)", [
    formNumber,
    perfect,
    imperfect,
    description,
  ]);

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

const idForCode = (scope: Db, code: string): Promise<number> =>
  scope.scalar<number>("SELECT morph_pattern_id_for_code($1)", [code]);

interface SyntheticPattern {
  code?: string | null;
  description: string;
  isLexical?: boolean;
  kinds?: [string, string, string];
  isGeminate?: boolean;
  vowels?: [string, string];
}

const SYNTHETIC_VOWELS: [string, string] = ["u", "i"];

const insertSyntheticPattern = (scope: Db, fields: SyntheticPattern): Promise<number> => {
  assert.match(fields.description, /^test only/, "synthetic patterns must be recognisable as test data");
  const [first, second, third] = fields.kinds ?? ["sound", "sound", "sound"];
  const [perfect, imperfect] = fields.vowels ?? SYNTHETIC_VOWELS;
  return scope.scalar<number>(
    `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical,
                                radical1_kind, radical2_kind, radical3_kind, is_geminate, perfect_vowel, imperfect_vowel)
     SELECT $1, 1, vocalic_template, $2, rules, $3,
            $4::radical_kind, $5::radical_kind, $6::radical_kind, $7, $8::short_vowel, $9::short_vowel
     FROM morph_pattern
     WHERE code = 'f1-a-u'
     RETURNING id`,
    [
      fields.code ?? null,
      fields.description,
      fields.isLexical ?? false,
      first,
      second,
      third,
      fields.isGeminate ?? false,
      perfect,
      imperfect,
    ],
  );
};

const resolutionRows = (scope: Db, id: number): Promise<string> =>
  scope.scalar<string>("SELECT count(*)::text FROM morph_pattern_resolution WHERE morph_pattern_id = $1", [id]);

const codeOf = (scope: Db, id: number): Promise<string> =>
  scope.scalar<string>("SELECT code FROM morph_pattern WHERE id = $1", [id]);

const resolutionMatrix = async (scope: Db): Promise<string[]> => {
  const cells: string[] = [];
  for (const sample of ROOT_SAMPLES) {
    for (const choice of verbFormChoices) {
      const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
      const id = await resolve(scope, sample.root, formNumber, perfectVowel, imperfectVowel);
      const code = id === null ? "-" : await codeOf(scope, id);
      cells.push(`${sample.root} ${choice} ${id ?? "-"} ${code}`);
    }
  }
  return cells;
};

test("morph_pattern_code derives the documented code from form, vowels and description", async () => {
  for (const [formNumber, perfect, imperfect, description, expected] of DERIVED_CODES) {
    assert.equal(
      await derivedCode(formNumber, perfect, imperfect, description),
      expected,
      `form ${formNumber} ${perfect ?? "-"}~${imperfect ?? "-"} ${JSON.stringify(description)}`,
    );
  }
});

test("every seeded pattern carries its canonical code", async () => {
  const rows = await db.rows<{ code: string; form_number: number; description: string }>(
    "SELECT code, form_number, description FROM morph_pattern",
  );
  const byCode = new Map(rows.map((row) => [row.code, row]));
  for (const [code, formNumber, description] of SEEDED_PATTERNS) {
    const row = byCode.get(code);
    assert.ok(row, `no pattern has the code ${code}`);
    assert.equal(row.form_number, formNumber, code);
    assert.equal(row.description, description, code);
  }
  for (const row of rows) {
    assert.match(row.code, /^f[0-9]+(-[a-z]+)*$/);
  }
});

test("a pattern inserted without a code gets the derived one, and the next free suffix on a clash", async () => {
  await db.tx(async (tx) => {
    const first = await insertSyntheticPattern(tx, {
      description: "test only, assimilated waw",
      kinds: ["waw", "sound", "sound"],
    });
    assert.equal(await codeOf(tx, first), "f1-u-i-test-only-assimilated-waw");

    const second = await insertSyntheticPattern(tx, {
      code: null,
      description: "test only: Assimilated WAW",
      isLexical: true,
    });
    assert.equal(await codeOf(tx, second), "f1-u-i-test-only-assimilated-waw-b");

    const third = await tx.scalar<number>(
      `INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, is_lexical, perfect_vowel, imperfect_vowel)
       SELECT 1, vocalic_template, 'test only - assimilated waw', rules, TRUE, 'u', 'i'
       FROM morph_pattern WHERE code = 'f1-a-u'
       RETURNING id`,
    );
    assert.equal(await codeOf(tx, third), "f1-u-i-test-only-assimilated-waw-c");
  });
});

test("an explicit code is kept as given and must be well formed and unique", async () => {
  await db.tx(async (tx) => {
    const id = await insertSyntheticPattern(tx, {
      code: "f1-u-i-test-only-chosen",
      description: "test only, anything",
      isLexical: true,
    });
    assert.equal(await codeOf(tx, id), "f1-u-i-test-only-chosen");

    for (const malformed of ["F1-u-i", "f1-u-i-2", "1-u-i", "f1--x", "f1-u-i-", "fx"]) {
      const failure = await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical, perfect_vowel, imperfect_vowel)
         SELECT $1::text, 1, vocalic_template, 'test only ' || $1::text, rules, TRUE, 'u', 'i'
         FROM morph_pattern WHERE code = 'f1-a-u'`,
        [malformed],
      );
      assertSqlState(failure, "23514", /chk_morph_pattern_code/);
    }

    const duplicate = await tx.failure(
      `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical, perfect_vowel, imperfect_vowel)
       SELECT 'f1-a-u', 1, vocalic_template, 'test only, another', rules, TRUE, 'u', 'i'
       FROM morph_pattern WHERE code = 'f1-a-u'`,
    );
    assertSqlState(duplicate, "23505", /unique_morph_pattern_code/);
  });
});

test("a code cannot change once set, while every other column stays editable", async () => {
  await db.tx(async (tx) => {
    const id = await insertSyntheticPattern(tx, { code: "f1-u-i-test-only-fixed", description: "test only, fixed" });
    const failure = await tx.failure("UPDATE morph_pattern SET code = 'f1-u-i-test-only-renamed' WHERE id = $1", [id]);
    assertSqlState(failure, "23000", /cannot change/);

    await tx.exec(
      `UPDATE morph_pattern SET description = 'test only, renamed', vocalic_template = vocalic_template, code = code
       WHERE id = $1`,
      [id],
    );
    assert.equal(await codeOf(tx, id), "f1-u-i-test-only-fixed");

    const seeded = await idForCode(tx, "f1-a-u");
    assertSqlState(await tx.failure("UPDATE morph_pattern SET code = 'f1-a-u-x' WHERE id = $1", [seeded]), "23000");
  });
});

test("renaming every pattern changes neither its code nor what any root resolves to", async () => {
  await db.tx(async (tx) => {
    const codesBefore = await tx.column<string>("SELECT id || ' ' || code FROM morph_pattern ORDER BY id");
    const matrixBefore = await resolutionMatrix(tx);
    assert.ok(
      matrixBefore.some((cell) => !cell.endsWith(" -")),
      "the matrix should resolve something",
    );

    await tx.exec("UPDATE morph_pattern SET description = 'test only, renamed pattern ' || id");

    assert.deepEqual(await tx.column<string>("SELECT id || ' ' || code FROM morph_pattern ORDER BY id"), codesBefore);
    assert.deepEqual(await resolutionMatrix(tx), matrixBefore);
    assert.equal(
      await resolve(tx, "رأي", 1, "a", "a"),
      await idForCode(tx, "f1-a-a-final-weak-hamzated-middle-hamza-elided"),
    );
    assert.equal(
      (await findPatternByCode(tx, "f1-a-u-hollow-waw")).description,
      `test only, renamed pattern ${await idForCode(tx, "f1-a-u-hollow-waw")}`,
    );
  });
});

test("morph_pattern_id_for_code finds a pattern by code and refuses an unknown code", async () => {
  assert.equal(await idForCode(db, "f10-hollow-waw"), (await findPatternByCode(db, "f10-hollow-waw")).id);
  assertSqlState(await db.failure("SELECT morph_pattern_id_for_code('f1-no-such')"), "P0002", /f1-no-such/);
});

test("every seeded shape pattern resolves its own shape and the seeded lexical pattern resolves none", async () => {
  const ownShapes: Record<string, string> = {
    "f1-a-a-final-weak": "sound/sound/ya",
    "f1-a-a-final-weak-hamzated-middle": "sound/hamza/ya",
    "f1-a-i-geminate": "sound/sound/sound/geminate",
    "f1-a-i-hollow-ya": "sound/ya/sound",
    "f1-a-u-hollow-waw": "sound/waw/sound",
    "f10-final-weak-waw": "sound/sound/waw",
    "f10-final-weak-ya": "sound/sound/ya",
    "f10-hollow-waw": "sound/waw/sound",
    "f4-final-weak-waw": "sound/sound/waw",
    "f4-final-weak-ya": "sound/sound/ya",
    "f8-final-weak-waw": "sound/sound/waw",
    "f8-final-weak-ya": "sound/sound/ya",
  };
  const rows = await db.rows<{ code: string; shape: string }>(
    `SELECT mp.code, r.radical1_kind || '/' || r.radical2_kind || '/' || r.radical3_kind ||
            CASE WHEN r.is_geminate THEN '/geminate' ELSE '' END AS shape
     FROM morph_pattern_resolution r JOIN morph_pattern mp ON mp.id = r.morph_pattern_id`,
  );
  const shapesByCode = new Map<string, Set<string>>();
  for (const row of rows) {
    const shapes = shapesByCode.get(row.code) ?? new Set<string>();
    shapes.add(row.shape);
    shapesByCode.set(row.code, shapes);
  }
  for (const [code] of SEEDED_PATTERNS) {
    if (code === "f1-a-a-final-weak-hamzated-middle-hamza-elided") {
      assert.equal(shapesByCode.get(code), undefined, `${code} is lexical and must not resolve any shape`);
      continue;
    }
    const expected = ownShapes[code] ?? "sound/sound/sound";
    assert.ok(shapesByCode.get(code)?.has(expected), `${code} does not resolve its own shape ${expected}`);
  }
});

test("the database refuses a second pattern for a shape and verb form that already resolve", async () => {
  await db.tx(async (tx) => {
    const holder = await insertSyntheticPattern(tx, { description: "test only, holder" });
    assert.equal(await resolve(tx, "كتب", 1, "u", "i"), holder);

    const failure = await tx.failure(
      `INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, perfect_vowel, imperfect_vowel)
       SELECT 1, vocalic_template, 'test only, duplicate of the holder', rules, 'u', 'i'
       FROM morph_pattern WHERE id = $1`,
      [holder],
    );
    assertSqlState(failure, "23505", /unique_morph_pattern_resolution_key/);

    const lexical = await insertSyntheticPattern(tx, { description: "test only, one verb", isLexical: true });
    assert.equal(await resolutionRows(tx, lexical), "0");
    assert.equal(await resolve(tx, "كتب", 1, "u", "i"), holder);

    const seededDuplicate = await tx.failure(
      `INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, perfect_vowel, imperfect_vowel)
       SELECT form_number, vocalic_template, 'test only, duplicate of f1-a-i', rules, perfect_vowel, imperfect_vowel
       FROM morph_pattern WHERE code = 'f1-a-i'`,
    );
    assertSqlState(seededDuplicate, "23505", /unique_morph_pattern_resolution_key/);
  });
});

test("add_morph_pattern_resolution lets one pattern serve a further root shape", async () => {
  await db.tx(async (tx) => {
    const sound = await insertSyntheticPattern(tx, { code: "f1-u-i-test-only-sound", description: "test only, sound" });
    await insertSyntheticPattern(tx, {
      code: "f1-u-i-test-only-assimilated",
      description: "test only, assimilated",
      kinds: ["waw", "sound", "sound"],
    });
    await insertSyntheticPattern(tx, {
      code: "f1-u-i-test-only-lexical",
      description: "test only, lexical",
      isLexical: true,
    });
    assert.equal(await resolve(tx, "أكل", 1, "u", "i"), null);

    const row = await tx.scalar<number>("SELECT add_morph_pattern_resolution('f1-u-i-test-only-sound', 'أكل')");
    assert.equal(await resolve(tx, "أكل", 1, "u", "i"), sound);
    assert.equal(await resolve(tx, "أخذ", 1, "u", "i"), sound);
    assert.equal(await resolve(tx, "أكل", 1, "i", "u"), null);
    assert.equal(await tx.scalar<number>("SELECT add_morph_pattern_resolution('f1-u-i-test-only-sound', 'أخذ')"), row);

    const shape = await tx.one<{
      form_number: number;
      perfect_vowel: string;
      imperfect_vowel: string;
      radical1_kind: string;
      radical2_kind: string;
    }>(
      `SELECT form_number, perfect_vowel::text, imperfect_vowel::text, radical1_kind::text, radical2_kind::text
       FROM morph_pattern_resolution WHERE id = $1`,
      [row],
    );
    assert.deepEqual(shape, {
      form_number: 1,
      perfect_vowel: "u",
      imperfect_vowel: "i",
      radical1_kind: "hamza",
      radical2_kind: "sound",
    });

    assertSqlState(
      await tx.failure("SELECT add_morph_pattern_resolution('f1-u-i-test-only-assimilated', 'كتب')"),
      "23505",
      /already resolves to pattern f1-u-i-test-only-sound/,
    );
    assertSqlState(await tx.failure("SELECT add_morph_pattern_resolution('f1-u-i-test-only-missing', 'أكل')"), "P0002");
    assertSqlState(
      await tx.failure("SELECT add_morph_pattern_resolution('f1-u-i-test-only-lexical', 'بيع')"),
      "23514",
      /lexical/,
    );
    assertSqlState(await tx.failure("SELECT add_morph_pattern_resolution('f1-u-i-test-only-sound', 'ترجم')"), "22023");
  });
});

test("a pattern's own shape follows edits to its radicals, vowels and lexical flag", async () => {
  await db.tx(async (tx) => {
    const id = await insertSyntheticPattern(tx, {
      code: "f1-u-i-test-only-moving",
      description: "test only, moving",
      kinds: ["waw", "sound", "sound"],
    });
    assert.equal(await resolve(tx, "وعد", 1, "u", "i"), id);
    assert.equal(await resolve(tx, "يسر", 1, "u", "i"), null);

    await tx.exec("UPDATE morph_pattern SET radical1_kind = 'ya' WHERE id = $1", [id]);
    assert.equal(await resolve(tx, "وعد", 1, "u", "i"), null);
    assert.equal(await resolve(tx, "يسر", 1, "u", "i"), id);

    await tx.exec("SELECT add_morph_pattern_resolution('f1-u-i-test-only-moving', 'وعد')");
    await tx.exec("UPDATE morph_pattern SET perfect_vowel = 'i', imperfect_vowel = 'u' WHERE id = $1", [id]);
    assert.equal(await resolve(tx, "يسر", 1, "u", "i"), null);
    assert.equal(await resolve(tx, "وعد", 1, "u", "i"), null);
    assert.equal(await resolve(tx, "يسر", 1, "i", "u"), id);
    assert.equal(await resolve(tx, "وعد", 1, "i", "u"), id);

    await tx.exec("UPDATE morph_pattern SET is_lexical = TRUE WHERE id = $1", [id]);
    assert.equal(await resolve(tx, "يسر", 1, "i", "u"), null);
    assert.equal(await resolve(tx, "وعد", 1, "i", "u"), null);

    await tx.exec("UPDATE morph_pattern SET is_lexical = FALSE WHERE id = $1", [id]);
    assert.equal(await resolve(tx, "يسر", 1, "i", "u"), id);
    assert.equal(await resolve(tx, "وعد", 1, "i", "u"), null);

    await tx.exec("UPDATE morph_pattern SET rules = rules, radical1_kind = radical1_kind WHERE id = $1", [id]);
    assert.equal(await resolve(tx, "يسر", 1, "i", "u"), id);

    await tx.exec("DELETE FROM morph_pattern WHERE id = $1", [id]);
    assert.equal(await resolve(tx, "يسر", 1, "i", "u"), null);
    assert.equal(await resolutionRows(tx, id), "0");
  });
});

test("moving a pattern onto a shape another pattern resolves is refused", async () => {
  await db.tx(async (tx) => {
    await insertSyntheticPattern(tx, { description: "test only, waw first", kinds: ["waw", "sound", "sound"] });
    const yaFirst = await insertSyntheticPattern(tx, {
      description: "test only, ya first",
      kinds: ["ya", "sound", "sound"],
    });
    const failure = await tx.failure("UPDATE morph_pattern SET radical1_kind = 'waw' WHERE id = $1", [yaFirst]);
    assertSqlState(failure, "23505", /unique_morph_pattern_resolution_key/);
  });
});
