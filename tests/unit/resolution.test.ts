import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVerbFormChoice, type VerbFormChoice, verbFormChoices } from "~/lib/validation/verbFormChoice";
import type { ShortVowel } from "~/server/db/schema";
import { ROOT_SAMPLES, rootFor } from "../fixtures/roots.ts";
import { assertArabicEqual, assertGolden, assertSqlState, conjugate, openDatabase } from "../harness";

const db = await openDatabase();

type ResolvedPattern = {
  form_number: number;
  description: string;
};

const columnLabel = (choice: VerbFormChoice) => choice.replace("form-", "").replaceAll("-", "");

const resolvePattern = (
  root: string,
  formNumber: number,
  perfectVowel: ShortVowel | null,
  imperfectVowel: ShortVowel | null,
): Promise<ResolvedPattern | null> =>
  db.maybeOne<ResolvedPattern>(
    `SELECT mp.form_number, mp.description
     FROM morph_pattern mp
     WHERE mp.id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)`,
    [root, formNumber, perfectVowel, imperfectVowel],
  );

const resolutionFailure = (
  root: string,
  formNumber: number,
  perfectVowel: ShortVowel | null,
  imperfectVowel: ShortVowel | null,
) =>
  db.failure("SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)", [
    root,
    formNumber,
    perfectVowel,
    imperfectVowel,
  ]);

const FORM_I_PAIRS: { perfect: ShortVowel; imperfect: ShortVowel; description: string }[] = [
  { perfect: "a", imperfect: "u", description: "a ~ u" },
  { perfect: "a", imperfect: "a", description: "a ~ a" },
  { perfect: "a", imperfect: "i", description: "a ~ i" },
  { perfect: "i", imperfect: "i", description: "i ~ i" },
  { perfect: "i", imperfect: "a", description: "i ~ a" },
  { perfect: "u", imperfect: "u", description: "u ~ u" },
];

test("every verb form choice offered by the picker maps to a real pattern shape", async () => {
  for (const choice of verbFormChoices) {
    const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
    const candidates = await db.scalar<string>("SELECT count(*)::text FROM morph_pattern WHERE form_number = $1::int", [
      formNumber,
    ]);
    assert.ok(Number(candidates) > 0, `the picker offers ${choice} but no pattern has form_number ${formNumber}`);
    if (formNumber === 1) {
      assert.ok(perfectVowel !== null && imperfectVowel !== null, `${choice} is form I but carries no vowel pair`);
    } else {
      assert.equal(perfectVowel, null, `${choice} is a derived form but carries a perfect vowel`);
      assert.equal(imperfectVowel, null, `${choice} is a derived form but carries an imperfect vowel`);
    }
  }
});

test("form I refuses to resolve without both vowels", async () => {
  const root = rootFor("sound");
  const incomplete: [ShortVowel | null, ShortVowel | null][] = [
    [null, "u"],
    ["a", null],
    [null, null],
  ];
  for (const [perfect, imperfect] of incomplete) {
    const failure = await resolutionFailure(root, 1, perfect, imperfect);
    assertSqlState(failure, "22023", /form I requires both a perfect and an imperfect vowel/);
  }
});

test("derived forms refuse vowels that only apply to form I", async () => {
  const root = rootFor("sound");
  const supplied: [ShortVowel | null, ShortVowel | null][] = [
    ["a", null],
    [null, "u"],
    ["a", "u"],
  ];
  for (const formNumber of [2, 10]) {
    for (const [perfect, imperfect] of supplied) {
      const failure = await resolutionFailure(root, formNumber, perfect, imperfect);
      assertSqlState(failure, "22023", new RegExp(`vowels only apply to form I, got form ${formNumber}`));
    }
  }
});

test("argument validation runs before the root is classified", async () => {
  const brokenRoot = "كتاب";
  const vowelFailure = await resolutionFailure(brokenRoot, 1, null, null);
  assertSqlState(vowelFailure, "22023", /form I requires both a perfect and an imperfect vowel/);

  const rootFailure = await resolutionFailure(brokenRoot, 2, null, null);
  assertSqlState(rootFailure, "22023", /must have exactly 3 radicals/);
});

test("every form I vowel pair resolves to its own pattern for a sound root", async () => {
  const root = rootFor("sound");
  for (const pair of FORM_I_PAIRS) {
    const resolved = await resolvePattern(root, 1, pair.perfect, pair.imperfect);
    assert.ok(resolved, `form I ${pair.perfect} ~ ${pair.imperfect} did not resolve for a sound root`);
    assert.equal(resolved.form_number, 1);
    assert.equal(resolved.description, pair.description);
  }
});

test("every derived form resolves for a sound root", async () => {
  const root = rootFor("sound");
  for (const formNumber of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const resolved = await resolvePattern(root, formNumber, null, null);
    assert.ok(resolved, `form ${formNumber} did not resolve for a sound root`);
    assert.equal(resolved.form_number, formNumber);
  }
});

test("the middle radical discriminates between hollow waw and hollow ya", async () => {
  const hollowWaw = rootFor("hollow-waw");
  const hollowYa = rootFor("hollow-ya");

  const wawWithAU = await resolvePattern(hollowWaw, 1, "a", "u");
  const yaWithAU = await resolvePattern(hollowYa, 1, "a", "u");
  assert.equal(wawWithAU?.description, "a ~ u, hollow waw");
  assert.equal(yaWithAU, null);

  const wawWithAI = await resolvePattern(hollowWaw, 1, "a", "i");
  const yaWithAI = await resolvePattern(hollowYa, 1, "a", "i");
  assert.equal(wawWithAI, null);
  assert.equal(yaWithAI?.description, "a ~ i, hollow ya");
});

test("a geminate root does not fall back to the plain sound pattern", async () => {
  const geminate = await resolvePattern(rootFor("geminate"), 1, "a", "i");
  const sound = await resolvePattern(rootFor("sound"), 1, "a", "i");
  assert.equal(geminate?.description, "a ~ i, geminate");
  assert.equal(sound?.description, "a ~ i");
});

test("a hamzated middle final-weak root resolves to a pattern that keeps its hamza", async () => {
  const root = rootFor("hamzated-second-final-weak-ya");
  const resolved = await resolvePattern(root, 1, "a", "a");
  assert.equal(resolved?.description, "a ~ a, final-weak, hamzated middle");

  const id = await db.scalar<number | null>(
    "SELECT resolve_morph_pattern_id($1, 1, 'a'::short_vowel, 'a'::short_vowel)",
    [root],
  );
  assert.ok(id !== null, `${root} did not resolve for form I a ~ a`);
  const paradigm = await conjugate(db, root, id);
  assertArabicEqual(
    paradigm.imperfect_indicative?.third_person_masculine_singular ?? null,
    "يَنْأَى",
    "the hamza of نأي is an ordinary consonant and must survive into the imperfect",
  );
  assertArabicEqual(paradigm.imperative?.second_person_masculine_singular ?? null, "اِنْأَ");
});

test("رأي resolves to its own lexical pattern instead of the shape pattern", async () => {
  const resolved = await resolvePattern("رأي", 1, "a", "a");
  assert.equal(resolved?.description, "a ~ a, final-weak, hamzated middle, hamza elided");
});

test("a lexical pattern is never reached by root shape alone", async () => {
  const lexical = await db.column<number>("SELECT id FROM morph_pattern WHERE is_lexical ORDER BY id");
  assert.ok(lexical.length > 0, "there should be at least one lexical pattern to guard");

  for (const sample of ROOT_SAMPLES) {
    const overridden = await db.scalar<string>(
      "SELECT count(*)::text FROM lexical_pattern_override WHERE root = strip_root_noise($1)",
      [sample.root],
    );
    if (Number(overridden) > 0) {
      continue;
    }
    for (const choice of verbFormChoices) {
      const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
      const id = await db.scalar<number | null>(
        "SELECT resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)",
        [sample.root, formNumber, perfectVowel, imperfectVowel],
      );
      assert.ok(
        id === null || !lexical.includes(id),
        `${sample.root} resolved ${choice} to lexical pattern ${id}, which describes one verb rather than a shape`,
      );
    }
  }
});

test("an override applies only to its own form and vowel pair", async () => {
  assert.equal(await resolvePattern("رأي", 1, "a", "u"), null);
  assert.equal(await resolvePattern("رأي", 1, "i", "a"), null);
  assert.equal(await resolvePattern("رأي", 2, null, null), null);
});

test("an override is found through the same root normalization classify_root uses", async () => {
  const noisy = ["رأي", "ر أ ي", "ر-أ-ي", "  رأي  ", "رـأـي"];
  for (const root of noisy) {
    const resolved = await resolvePattern(root, 1, "a", "a");
    assert.equal(
      resolved?.description,
      "a ~ a, final-weak, hamzated middle, hamza elided",
      `override lookup missed for ${JSON.stringify(root)}`,
    );
  }
});

test("every override row points at a pattern whose form and vowels it agrees with", async () => {
  const mismatched = await db.rows<{ detail: string }>(
    `SELECT format('%s: override says form %s %s~%s, pattern %s says form %s %s~%s',
                   o.root, o.form_number, COALESCE(o.perfect_vowel::text, 'none'),
                   COALESCE(o.imperfect_vowel::text, 'none'), mp.id, mp.form_number,
                   COALESCE(mp.perfect_vowel::text, 'none'), COALESCE(mp.imperfect_vowel::text, 'none')) AS detail
     FROM lexical_pattern_override o
     JOIN morph_pattern mp ON mp.id = o.morph_pattern_id
     WHERE mp.form_number <> o.form_number
        OR mp.perfect_vowel IS DISTINCT FROM o.perfect_vowel
        OR mp.imperfect_vowel IS DISTINCT FROM o.imperfect_vowel`,
  );
  assert.deepEqual(
    mismatched.map((row) => row.detail),
    [],
    "an override that disagrees with its pattern hands the picker a pattern for a different verb form",
  );
});

test("every override root is stored in the normalized form the resolver looks up", async () => {
  const unnormalized = await db.column<string>(
    "SELECT root FROM lexical_pattern_override WHERE root <> strip_root_noise(root)",
  );
  assert.deepEqual(
    unnormalized,
    [],
    "the resolver looks up strip_root_noise(root), so a noisy stored root is dead data",
  );
});

test("an uncatalogued root shape returns NULL instead of raising", async () => {
  const resolved = await resolvePattern(rootFor("assimilated-waw"), 1, "a", "u");
  assert.equal(resolved, null);
});

test("no two patterns share a resolution key", async () => {
  const duplicates = await db.rows<{ detail: string }>(
    `SELECT format(
              'form %s / %s %s %s / geminate=%s / vowels %s~%s appears %s times',
              form_number, radical1_kind, radical2_kind, radical3_kind, is_geminate,
              COALESCE(perfect_vowel::text, 'none'), COALESCE(imperfect_vowel::text, 'none'), count(*)
            ) AS detail
     FROM morph_pattern
     WHERE NOT is_lexical
     GROUP BY form_number, radical1_kind, radical2_kind, radical3_kind, is_geminate, perfect_vowel, imperfect_vowel
     HAVING count(*) > 1
     ORDER BY 1`,
  );
  assert.deepEqual(
    duplicates.map((row) => row.detail),
    [],
    "resolve_morph_pattern_id ends in ORDER BY id LIMIT 1, so duplicate resolution keys would be silently disambiguated. " +
      "A pattern that describes one verb rather than a root shape belongs behind is_lexical and lexical_pattern_override.",
  );
});

test("the coverage matrix matches its golden", async () => {
  const ordered = verbFormChoices;
  const shapes = [...new Set(ROOT_SAMPLES.map((sample) => sample.shape))].sort();

  const resolutions = new Map<string, ResolvedPattern | null>();
  for (const shape of shapes) {
    for (const choice of ordered) {
      const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
      const resolved = await resolvePattern(rootFor(shape), formNumber, perfectVowel, imperfectVowel);
      resolutions.set(`${shape}|${choice}`, resolved);
    }
  }

  const shapeWidth = Math.max(...shapes.map((shape) => shape.length), "shape".length) + 1;
  const cellWidth = Math.max(...ordered.map((choice) => columnLabel(choice).length), 1) + 1;

  const lines = [
    "resolve_morph_pattern_id coverage matrix",
    "========================================",
    "",
    "Which (root shape, verb form choice) pairs currently resolve to a morph_pattern row.",
    "",
    "Gaps are expected, not failures. The pattern catalogue in db/0004_add_morphological_patterns.sql",
    "is incomplete, so an unresolved pair means the verb form picker finds no pattern for that root.",
    "This file exists so that adding patterns later shows up as an intentional diff, and so that",
    "losing coverage fails loudly.",
    "",
    "Columns are the verb form choices declared in src/lib/validation/verbFormChoice.ts, in their",
    "declared order. 1au..1uu are form I with the given perfect ~ imperfect vowel pair, 2..10 are",
    "the derived forms.",
    "",
    "  X = resolves to a pattern",
    "  - = resolve_morph_pattern_id returns NULL",
    "",
    ["shape".padEnd(shapeWidth), ...ordered.map((choice) => columnLabel(choice).padEnd(cellWidth))].join("").trimEnd(),
    ["-".repeat(shapeWidth - 1).padEnd(shapeWidth), ...ordered.map(() => "-".repeat(cellWidth - 1).padEnd(cellWidth))]
      .join("")
      .trimEnd(),
  ];

  for (const shape of shapes) {
    const cells = ordered.map((choice) => (resolutions.get(`${shape}|${choice}`) ? "X" : "-").padEnd(cellWidth));
    lines.push([shape.padEnd(shapeWidth), ...cells].join("").trimEnd());
  }

  lines.push("", "Root used for each shape", "------------------------");
  for (const shape of shapes) {
    lines.push(`  ${shape.padEnd(shapeWidth)}${rootFor(shape)}`);
  }

  lines.push("", "Resolved pairs in detail", "------------------------");
  for (const shape of shapes) {
    const resolvedForShape = ordered
      .map((choice) => ({ choice, resolved: resolutions.get(`${shape}|${choice}`) ?? null }))
      .filter((entry) => entry.resolved !== null);
    if (resolvedForShape.length === 0) {
      lines.push(`  ${shape.padEnd(shapeWidth)}(nothing resolves)`);
      continue;
    }
    for (const entry of resolvedForShape) {
      const resolved = entry.resolved;
      if (!resolved) {
        continue;
      }
      lines.push(
        `  ${shape.padEnd(shapeWidth)}${entry.choice.padEnd(12)}form ${resolved.form_number}, "${resolved.description}"`,
      );
    }
  }

  lines.push("", "Lexical overrides", "-----------------");
  lines.push("", "Roots whose pattern is chosen by lexical_pattern_override rather than by root shape.", "");
  const overrides = await db.rows<{
    root: string;
    form_number: number;
    perfect_vowel: string | null;
    imperfect_vowel: string | null;
    description: string;
    is_lexical: boolean;
  }>(
    `SELECT o.root, o.form_number, o.perfect_vowel::text, o.imperfect_vowel::text, mp.description, mp.is_lexical
     FROM lexical_pattern_override o
     JOIN morph_pattern mp ON mp.id = o.morph_pattern_id
     ORDER BY o.form_number, o.perfect_vowel, o.imperfect_vowel, o.root`,
  );
  if (overrides.length === 0) {
    lines.push("  (none)");
  }
  for (const override of overrides) {
    const vowels =
      override.perfect_vowel && override.imperfect_vowel
        ? `${override.perfect_vowel} ~ ${override.imperfect_vowel}`
        : "none";
    const marker = override.is_lexical ? " [is_lexical]" : "";
    lines.push(
      `  form ${override.form_number} ${vowels.padEnd(6)} "${override.description}"${marker}  ${override.root}`,
    );
  }

  await assertGolden("resolution-matrix.txt", `${lines.join("\n")}\n`);
});
