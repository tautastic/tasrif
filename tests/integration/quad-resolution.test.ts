import assert from "node:assert/strict";
import { test } from "node:test";
import {
  quadriliteralVerbFormChoices,
  resolveVerbFormChoice,
  verbFormChoiceRadicalCount,
  verbFormChoices,
} from "~/lib/validation/verbFormChoice";
import { assertGolden, assertSqlState, openDatabase } from "../harness";

const db = await openDatabase();

const COLUMN_WIDTH = 29;

const SHAPES: [shape: string, root: string][] = [
  ["sound", "دحرج"],
  ["reduplicated", "زلزل"],
  ["glide-second", "سيطر"],
  ["glide-third", "هرول"],
  ["waw-first", "وسوس"],
  ["hamza-first", "أسلم"],
  ["hamza-other", "طمأن"],
  ["third-equals-fourth", "جلبب"],
  ["final-weak-ya", "سلقي"],
  ["final-weak-ya", "غردي"],
  ["final-weak-waw", "سلقو"],
];

const resolveCode = async (root: string, choice: (typeof quadriliteralVerbFormChoices)[number]) => {
  const { formNumber, perfectVowel, imperfectVowel, radicalCount } = resolveVerbFormChoice(choice);
  return db.scalar<string | null>(
    `SELECT (SELECT code FROM morph_pattern WHERE id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int))`,
    [root, formNumber, perfectVowel, imperfectVowel, radicalCount],
  );
};

test("the quadriliteral picker choices carry a radical count of four, the others three", () => {
  for (const choice of quadriliteralVerbFormChoices) {
    assert.equal(verbFormChoiceRadicalCount(choice), 4, choice);
  }
  for (const choice of verbFormChoices) {
    assert.equal(verbFormChoiceRadicalCount(choice), 3, choice);
  }
});

test("every quadriliteral verb form choice maps to a pattern of its form, vowels and radical count", async () => {
  for (const choice of quadriliteralVerbFormChoices) {
    const { formNumber, perfectVowel, imperfectVowel, radicalCount } = resolveVerbFormChoice(choice);
    const count = await db.scalar<string>(
      `SELECT count(*)::text FROM morph_pattern
       WHERE form_number = $1::int AND radical_count = $2::int
         AND perfect_vowel IS NOT DISTINCT FROM $3::short_vowel AND imperfect_vowel IS NOT DISTINCT FROM $4::short_vowel`,
      [formNumber, radicalCount, perfectVowel, imperfectVowel],
    );
    assert.ok(Number(count) > 0, `${choice} has no pattern`);
  }
});

test("a triliteral verb form choice refuses a four-letter root", async () => {
  for (const choice of verbFormChoices) {
    const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
    const failure = await db.failure("SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)", [
      "دحرج",
      formNumber,
      perfectVowel,
      imperfectVowel,
    ]);
    assertSqlState(failure, "22023", /root 'دحرج' must have exactly 3 radicals after normalization, found 4/);
  }
});

test("a quadriliteral verb form choice refuses a three-letter root", async () => {
  for (const choice of quadriliteralVerbFormChoices) {
    const { formNumber, perfectVowel, imperfectVowel, radicalCount } = resolveVerbFormChoice(choice);
    const failure = await db.failure(
      "SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, $5::int)",
      ["كتب", formNumber, perfectVowel, imperfectVowel, radicalCount],
    );
    assertSqlState(failure, "22023", /root 'كتب' must have exactly 4 radicals after normalization, found 3/);
  }
});

test("the quadriliteral coverage matrix matches its golden", async () => {
  const lines = [
    "resolve_morph_pattern_id coverage matrix for four radicals",
    "==========================================================",
    "",
    "Which (root shape, quadriliteral verb form choice) pairs resolve to a morph_pattern row.",
    "A weak letter before the last radical is a consonant, so every such root takes the sound pattern;",
    "a root whose last radical is و or ي is final-weak: a ya has a pattern in form 3q only, from its conjugation tables,",
    "and a waw has none until a table supplies one.",
    "",
    "Columns are the choices declared in src/lib/validation/verbFormChoice.ts as quadriliteralVerbFormChoices.",
    "",
    `${"shape".padEnd(22)}${"root".padEnd(8)}${quadriliteralVerbFormChoices.map((choice) => choice.replace("form-", "").padEnd(COLUMN_WIDTH)).join("")}`.trimEnd(),
    `${"-".repeat(21)} ${"-".repeat(7)} ${quadriliteralVerbFormChoices.map(() => `${"-".repeat(COLUMN_WIDTH - 1)} `).join("")}`.trimEnd(),
  ];
  for (const [shape, root] of SHAPES) {
    const cells: string[] = [];
    for (const choice of quadriliteralVerbFormChoices) {
      cells.push(((await resolveCode(root, choice)) ?? "-").padEnd(COLUMN_WIDTH));
    }
    lines.push(`${shape.padEnd(22)}${root.padEnd(8)}${cells.join("")}`.trimEnd());
  }
  await assertGolden("quad-resolution-matrix.txt", `${lines.join("\n")}\n`);
});
