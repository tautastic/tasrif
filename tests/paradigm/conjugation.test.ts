import assert from "node:assert/strict";
import { test } from "node:test";
import { type DeviationKey, PARADIGM_FIXTURES } from "../fixtures/paradigms.ts";
import {
  assertArabicEqual,
  assertParadigmEqual,
  codepointsOf,
  conjugate,
  findPattern,
  MOODS,
  type Mood,
  openDatabase,
  type Paradigm,
  PERSONS,
  type Person,
} from "../harness";

const db = await openDatabase();

const patternIdFor = async (formNumber: number, description: string): Promise<number> =>
  (await findPattern(db, formNumber, description)).id;

const generateRows = async (root: string, rules: unknown, formNumber: number, noAffix: boolean): Promise<Paradigm> => {
  const rows = await db.rows<{ mood: Mood; person: Person; form: string }>(
    `SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
     FROM generate_conjugation_rows($1, $2::jsonb, $3::integer, '{}'::jsonb, $4::boolean) cr,
          LATERAL jsonb_each_text(cr.person_forms) kv`,
    [root, JSON.stringify(rules), formNumber, noAffix],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

const withDeviations = (
  cells: Record<string, string>,
  deviations: Partial<Record<DeviationKey, string>> | undefined,
  mood: string,
): Record<string, string> => {
  if (!deviations) {
    return cells;
  }
  const merged = { ...cells };
  for (const [key, value] of Object.entries(deviations)) {
    const [deviationMood, person] = key.split(".");
    if (deviationMood === mood && person && value !== undefined) {
      merged[person] = value;
    }
  }
  return merged;
};

for (const fixture of PARADIGM_FIXTURES) {
  const heading = `${fixture.id} (${fixture.citationForm}, ${fixture.gloss})`;

  test(`perfect paradigm of ${heading}`, async () => {
    const patternId = await patternIdFor(fixture.formNumber, fixture.description);
    const paradigm = await conjugate(db, fixture.root, patternId);
    const expected = withDeviations(fixture.perfect, fixture.engineDeviations, "perfect");
    assert.equal(Object.keys(paradigm.perfect ?? {}).length, 13);
    assertParadigmEqual(paradigm.perfect ?? {}, expected, `${heading} perfect\n${fixture.source}`);
  });

  test(`imperative paradigm of ${heading}`, async () => {
    const patternId = await patternIdFor(fixture.formNumber, fixture.description);
    const paradigm = await conjugate(db, fixture.root, patternId);
    const expected = withDeviations(
      fixture.imperative as Record<string, string>,
      fixture.engineDeviations,
      "imperative",
    );
    assert.equal(Object.keys(paradigm.imperative ?? {}).length, 5);
    assertParadigmEqual(paradigm.imperative ?? {}, expected, `${heading} imperative\n${fixture.source}`);
  });

  test(`imperfect indicative paradigm of ${heading}`, async () => {
    const patternId = await patternIdFor(fixture.formNumber, fixture.description);
    const paradigm = await conjugate(db, fixture.root, patternId);
    const expected = withDeviations(fixture.imperfectIndicative, fixture.engineDeviations, "imperfect_indicative");
    assert.equal(Object.keys(paradigm.imperfect_indicative ?? {}).length, 13);
    assertParadigmEqual(
      paradigm.imperfect_indicative ?? {},
      expected,
      `${heading} imperfect indicative\n${fixture.source}`,
    );
  });
}

test("imperfect_stem fans out into the three imperfect moods with mood-specific endings", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const paradigm = await conjugate(db, "كتب", patternId);

  assertArabicEqual(paradigm.imperfect_indicative?.third_person_masculine_singular ?? null, "يَكْتُبُ");
  assertArabicEqual(paradigm.imperfect_subjunctive?.third_person_masculine_singular ?? null, "يَكْتُبَ");
  assertArabicEqual(paradigm.imperfect_jussive?.third_person_masculine_singular ?? null, "يَكْتُبْ");

  assertArabicEqual(paradigm.imperfect_subjunctive?.third_person_masculine_plural ?? null, "يَكْتُبُوا");
  assertArabicEqual(paradigm.imperfect_jussive?.third_person_masculine_plural ?? null, "يَكْتُبُوا");
  assertArabicEqual(paradigm.imperfect_subjunctive?.second_person_feminine_singular ?? null, "تَكْتُبِي");
  assertArabicEqual(paradigm.imperfect_jussive?.second_person_feminine_plural ?? null, "تَكْتُبْنَ");

  for (const mood of ["imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"] as const) {
    assert.equal(Object.keys(paradigm[mood] ?? {}).length, 13, `${mood} should carry all 13 persons`);
  }
});

test("explicit imperfect mood keys are used as written rather than derived from a shared stem", async () => {
  const patternId = await patternIdFor(1, "a ~ u, hollow waw");
  const paradigm = await conjugate(db, "قول", patternId);

  assertArabicEqual(paradigm.imperfect_indicative?.third_person_masculine_singular ?? null, "يَقُولُ");
  assertArabicEqual(paradigm.imperfect_subjunctive?.third_person_masculine_singular ?? null, "يَقُولَ");
  assertArabicEqual(paradigm.imperfect_jussive?.third_person_masculine_singular ?? null, "يَقُلْ");
  assertArabicEqual(paradigm.imperfect_jussive?.first_person_singular ?? null, "أَقُلْ");
  assertArabicEqual(paradigm.imperfect_jussive?.third_person_masculine_plural ?? null, "يَقُولُوا");
});

test("the final-weak pattern keeps its irregular subjunctive and jussive", async () => {
  const patternId = await patternIdFor(1, "a ~ a, final-weak");
  const paradigm = await conjugate(db, "سعي", patternId);

  assertArabicEqual(paradigm.imperfect_subjunctive?.third_person_masculine_singular ?? null, "يَسْعَى");
  assertArabicEqual(paradigm.imperfect_jussive?.third_person_masculine_singular ?? null, "يَسْعَ");
  assertArabicEqual(paradigm.imperfect_jussive?.third_person_masculine_plural ?? null, "يَسْعَوْا");
});

test("non-mood rule keys produce no conjugation rows", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const ruleKeys = await db.column<string>(
    "SELECT jsonb_object_keys(rules) FROM morph_pattern WHERE id = $1 ORDER BY 1",
    [patternId],
  );
  assert.ok(ruleKeys.includes("masdar"));
  assert.ok(ruleKeys.includes("active_participle"));
  assert.ok(ruleKeys.includes("passive_participle"));

  const paradigm = await conjugate(db, "كتب", patternId);
  assert.deepEqual(Object.keys(paradigm).sort(), [...MOODS].sort());
});

test("p_no_affix replicates a string template across all thirteen persons", async () => {
  const paradigm = await generateRows("كتب", { perfect: "{1}َ{2}َ{3}" }, 1, true);
  const cells = paradigm.perfect ?? {};
  assert.deepEqual(Object.keys(cells).sort(), [...PERSONS].sort());
  for (const person of PERSONS) {
    assertArabicEqual(cells[person] ?? null, "كَتَب", `person ${person}`);
  }
});

test("p_no_affix fans an imperfect_stem string template into three identical imperfect moods", async () => {
  const paradigm = await generateRows("كتب", { imperfect_stem: "{1}ْ{2}ُ{3}" }, 1, true);
  const indicative = paradigm.imperfect_indicative ?? {};
  assert.deepEqual(Object.keys(paradigm).sort(), [
    "imperfect_indicative",
    "imperfect_jussive",
    "imperfect_subjunctive",
  ]);
  assert.deepEqual(paradigm.imperfect_subjunctive, indicative);
  assert.deepEqual(paradigm.imperfect_jussive, indicative);
  assertArabicEqual(indicative.third_person_masculine_singular ?? null, "كْتُب");
});

test("p_no_affix passes an object template through untouched", async () => {
  const paradigm = await generateRows(
    "قول",
    { perfect: { third_person_masculine_singular: "{1}َا{3}َ", first_person_singular: "{1}ُ{3}ْتُ" } },
    1,
    true,
  );
  assert.deepEqual(Object.keys(paradigm.perfect ?? {}).sort(), [
    "first_person_singular",
    "third_person_masculine_singular",
  ]);
  assertArabicEqual(paradigm.perfect?.third_person_masculine_singular ?? null, "قَالَ");
  assertArabicEqual(paradigm.perfect?.first_person_singular ?? null, "قُلْتُ");
});

test("an unknown rule key is ignored entirely", async () => {
  const paradigm = await generateRows("كتب", { perfect: "{1}َ{2}َ{3}", elative: "أَ{1}ْ{2}َ{3}" }, 1, false);
  assert.deepEqual(Object.keys(paradigm), ["perfect"]);
});

test("every seeded pattern yields the expected cell counts per mood", async () => {
  const patterns = await db.rows<{ id: number; form_number: number; description: string; is_geminate: boolean }>(
    "SELECT id, form_number, description, is_geminate FROM morph_pattern ORDER BY form_number, id",
  );
  for (const pattern of patterns) {
    const root = pattern.is_geminate ? "مدد" : "كتب";
    const paradigm = await conjugate(db, root, pattern.id);
    const label = `form ${pattern.form_number} "${pattern.description}"`;
    assert.equal(Object.keys(paradigm.perfect ?? {}).length, 13, `${label} perfect`);
    assert.equal(Object.keys(paradigm.imperative ?? {}).length, 5, `${label} imperative`);
    for (const mood of ["imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"] as const) {
      assert.equal(Object.keys(paradigm[mood] ?? {}).length, 13, `${label} ${mood}`);
    }
  }
});

test("gemination-derived and affix-derived shaddas agree on codepoint order within one paradigm", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const paradigm = await conjugate(db, "سكن", patternId);

  const geminated = paradigm.perfect?.first_person_plural ?? "";
  const affixed = paradigm.perfect?.second_person_feminine_plural ?? "";

  assert.deepEqual(
    codepointsOf(geminated).map((point) => point.label),
    [
      "U+0633 SEEN",
      "U+064E FATHA",
      "U+0643 KAF",
      "U+064E FATHA",
      "U+0646 NOON",
      "U+064E FATHA",
      "U+0651 SHADDA",
      "U+0627 ALEF",
    ],
  );

  assert.deepEqual(
    codepointsOf(affixed)
      .map((point) => point.label)
      .slice(-3),
    ["U+0646 NOON", "U+064E FATHA", "U+0651 SHADDA"],
  );
});

test("the gemination branch is reached from the perfect, imperative and imperfect of a ن-final root", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const paradigm = await conjugate(db, "سكن", patternId);
  const cells = [
    paradigm.perfect?.first_person_plural,
    paradigm.perfect?.third_person_feminine_plural,
    paradigm.imperative?.second_person_feminine_plural,
    paradigm.imperfect_indicative?.second_person_feminine_plural,
    paradigm.imperfect_indicative?.third_person_feminine_plural,
  ];
  for (const cell of cells) {
    assert.ok(cell !== undefined);
    assert.ok(!cell.includes("نْن"), `${cell} still contains an unassimilated NOON SUKUN NOON`);
    assert.match(
      cell,
      /\u0646[\u064B-\u0650]\u0651/,
      `${cell} should carry a gemination-derived NOON with its vowel before the SHADDA`,
    );
  }
});
