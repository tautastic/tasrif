import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOT_SAMPLES, representativeRootFor } from "../fixtures/roots.ts";
import { describeArabic, IMPERATIVE_PERSONS, listPatterns, openDatabase, PERSONS } from "../harness";

const db = await openDatabase();

const ROOTS = [...new Set(ROOT_SAMPLES.map((sample) => sample.root))];
const ROOT_ARRAY = `{${ROOTS.join(",")}}`;

const CROSS_PRODUCT = `
  WITH roots AS (SELECT unnest($1::text[]) AS root),
       generated AS (
         SELECT mp.form_number, mp.description, r.root, cr.mood::text AS mood,
                kv.key AS person, kv.value AS form
         FROM morph_pattern mp
         CROSS JOIN roots r,
              LATERAL generate_conjugation_rows(r.root, mp.rules, mp.form_number, '{}'::jsonb, mp.no_affix) cr,
              LATERAL jsonb_each_text(cr.person_forms) kv
       )`;

interface Offender extends Record<string, unknown> {
  form_number: number;
  description: string;
  root: string;
  mood: string;
  person: string;
  form: string;
}

const SHADDA = "ّ";
const SUKUN = "ْ";
const SHORT_VOWEL_CLASS = "[ً-ِْ]";
const NON_ARABIC_CLASS = "[^؀-ۿ]";
const PLACEHOLDER_PATTERN = "\\{[0-9]+\\}";
const STACKED_VOWELS_PATTERN = `${SHORT_VOWEL_CLASS}${SHORT_VOWEL_CLASS}`;
const SHADDA_SUKUN_PATTERN = `${SHADDA}${SUKUN}|${SUKUN}${SHADDA}`;

const offenders = (predicate: string, pattern?: string) =>
  db.rows<Offender>(
    `${CROSS_PRODUCT}
     SELECT form_number, description, root, mood, person, form
     FROM generated WHERE ${predicate}
     ORDER BY form_number, description, root, mood, person
     LIMIT 25`,
    pattern === undefined ? [ROOT_ARRAY] : [ROOT_ARRAY, pattern],
  );

const report = (rows: Offender[]) =>
  rows
    .map(
      (row) =>
        `form ${row.form_number} "${row.description}" root ${row.root} ${row.mood}/${row.person}\n  ${describeArabic(row.form)}`,
    )
    .join("\n");

const assertNoOffenders = async (predicate: string, what: string, pattern?: string) => {
  const rows = await offenders(predicate, pattern);
  assert.equal(rows.length, 0, `${what}\n${report(rows)}`);
};

test("the cross product actually generates a substantial corpus", async () => {
  const total = Number(await db.scalar<string>(`${CROSS_PRODUCT} SELECT count(*)::text FROM generated`, [ROOT_ARRAY]));
  assert.ok(total > 10_000, `expected a five figure corpus, generated only ${total} forms`);
});

test("no generated form keeps a radical placeholder", async () => {
  await assertNoOffenders("form ~ $2", "replace_root_placeholders left a placeholder behind", PLACEHOLDER_PATTERN);
});

test("normalizing a generated form is idempotent", async () => {
  await assertNoOffenders(
    `normalize_arabic_orthography(normalize_arabic_orthography(form))
       IS DISTINCT FROM normalize_arabic_orthography(form)`,
    "a second pass of normalize_arabic_orthography changed the form, so the rewrite rules do not reach a fixed point",
  );
});

test("the generator hands back forms that are already normalized", async () => {
  await assertNoOffenders(
    "normalize_arabic_orthography(form) IS DISTINCT FROM form",
    "a generated cell escaped normalization, so a code path is returning a raw template expansion",
  );
});

test("no generated form is empty or blank", async () => {
  await assertNoOffenders("btrim(form) = ''", "an empty cell is inserted as a conjugation row and shown in the UI");
});

test("no generated form stacks two short vowels", async () => {
  await assertNoOffenders("form ~ $2", "two consecutive harakat cannot be pronounced", STACKED_VOWELS_PATTERN);
});

test("no generated form places shadda next to sukun", async () => {
  await assertNoOffenders("form ~ $2", "a geminated consonant is never also vowelless", SHADDA_SUKUN_PATTERN);
});

test("generated forms contain only Arabic characters", async () => {
  await assertNoOffenders(
    "form ~ $2",
    "a stray latin or punctuation character leaked out of a template",
    NON_ARABIC_CLASS,
  );
});

test("every pattern generates a complete paradigm for a root of its own shape", async () => {
  const patterns = await listPatterns(db);
  const pairs = patterns.map((pattern) => ({
    id: pattern.id,
    root: representativeRootFor(
      pattern.radical1_kind,
      pattern.radical2_kind,
      pattern.radical3_kind,
      pattern.is_geminate,
    ),
  }));

  const counts = await db.rows<{ id: number; form_number: number; description: string; mood: string; cells: number }>(
    `WITH pairs AS (
       SELECT (value ->> 'id')::int AS pattern_id, value ->> 'root' AS root
       FROM jsonb_array_elements($1::jsonb)
     )
     SELECT mp.id, mp.form_number, mp.description, cr.mood::text AS mood,
            (SELECT count(*) FROM jsonb_object_keys(cr.person_forms))::int AS cells
     FROM pairs p
     JOIN morph_pattern mp ON mp.id = p.pattern_id,
          LATERAL generate_conjugation_rows(p.root, mp.rules, mp.form_number, '{}'::jsonb, mp.no_affix) cr
     ORDER BY mp.form_number, mp.id, cr.mood::text`,
    [JSON.stringify(pairs)],
  );

  const expectedCells = (mood: string) => (mood === "imperative" ? IMPERATIVE_PERSONS.length : PERSONS.length);
  const byPattern = new Map<number, { mood: string; cells: number }[]>();
  for (const row of counts) {
    byPattern.set(row.id, [...(byPattern.get(row.id) ?? []), { mood: row.mood, cells: row.cells }]);
  }

  const problems: string[] = [];
  for (const pattern of patterns) {
    const moods = byPattern.get(pattern.id) ?? [];
    const label = `form ${pattern.form_number} "${pattern.description}"`;
    const names = [...new Set(moods.map((entry) => entry.mood))].sort();
    if (names.length !== 5) {
      problems.push(`${label} produced moods [${names.join(", ")}] instead of all five`);
      continue;
    }
    for (const entry of moods) {
      if (entry.cells !== expectedCells(entry.mood)) {
        problems.push(`${label} ${entry.mood} produced ${entry.cells} cells, expected ${expectedCells(entry.mood)}`);
      }
    }
  }

  assert.deepEqual(problems, [], `incomplete paradigms:\n${problems.join("\n")}`);
});

const VOWEL_THEN_SHADDA = `${SHORT_VOWEL_CLASS}${SHADDA}`;
const SHADDA_THEN_VOWEL = `${SHADDA}${SHORT_VOWEL_CLASS}`;

const GEMINATING_ROOTS = ["أمن", "سكن", "ثبت"];

const formsMatching = (roots: string[], pattern: string) =>
  db.rows<Offender>(
    `${CROSS_PRODUCT}
     SELECT form_number, description, root, mood, person, form
     FROM generated WHERE form ~ $2
     ORDER BY form_number, description, root, mood, person
     LIMIT 25`,
    [`{${roots.join(",")}}`, pattern],
  );

test("every seeded template and affix writes shadda after the vowel", async () => {
  const rows = await db.rows<{ source: string; text: string }>(
    `WITH written AS (
       SELECT 'morph_pattern ' || mp.form_number || ' ' || k AS source,
              CASE WHEN jsonb_typeof(mp.rules -> k) = 'object'
                   THEN (SELECT string_agg(value, ' ') FROM jsonb_each_text(mp.rules -> k))
                   ELSE mp.rules ->> k END AS text
       FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
       UNION ALL
       SELECT 'affix_rules ' || mood::text || ' ' || person::text,
              coalesce(prefix, '') || coalesce(suffix, '')
       FROM affix_rules
     )
     SELECT source, text FROM written WHERE text ~ $1 ORDER BY source`,
    [SHADDA_THEN_VOWEL],
  );
  assert.equal(
    rows.length,
    0,
    `the hand written data follows one convention, vowel then shadda:\n${rows
      .map((row) => `${row.source}\n  ${describeArabic(row.text)}`)
      .join("\n")}`,
  );
});

test("no generated form writes shadda before the vowel", async () => {
  const offending = await formsMatching([...ROOTS, ...GEMINATING_ROOTS], SHADDA_THEN_VOWEL);
  assert.deepEqual(
    offending.map(
      (row) =>
        `form ${row.form_number} ${row.description} ${row.root} ${row.mood}/${row.person} ${describeArabic(row.form)}`,
    ),
    [],
    "shadda carries combining class 33 and the short vowels 30, so vowel-then-shadda is the only canonical order",
  );
});

test("gemination derived and affix derived shaddas agree on order within one paradigm", async () => {
  const clash = await db.rows<{ person: string; form: string }>(
    `SELECT kv.key AS person, kv.value AS form
     FROM morph_pattern mp,
          LATERAL generate_conjugation_rows('أمن', mp.rules, mp.form_number, '{}'::jsonb, mp.no_affix) cr,
          LATERAL jsonb_each_text(cr.person_forms) kv
     WHERE mp.form_number = 1 AND mp.description = 'i ~ a' AND cr.mood = 'perfect'
       AND kv.key IN ('first_person_plural', 'second_person_feminine_plural')
     ORDER BY kv.key`,
  );
  const byPerson = new Map(clash.map((row) => [row.person, row.form]));
  const geminated = byPerson.get("first_person_plural") ?? "";
  const affixed = byPerson.get("second_person_feminine_plural") ?? "";

  assert.match(
    geminated,
    new RegExp(VOWEL_THEN_SHADDA),
    `gemination must collapse the doubled noon and leave the vowel first\n${describeArabic(geminated)}`,
  );
  assert.match(
    affixed,
    new RegExp(VOWEL_THEN_SHADDA),
    `the affix carries its own shadda after the vowel\n${describeArabic(affixed)}`,
  );
});

test("every generated form is already unicode NFC normalized", async () => {
  const rows = await db.rows<Offender>(
    `${CROSS_PRODUCT}
     SELECT form_number, description, root, mood, person, form FROM generated
     ORDER BY form_number, description, root, mood, person`,
    [`{${[...ROOTS, ...GEMINATING_ROOTS].join(",")}}`],
  );
  const notCanonical = rows.filter((row) => row.form !== row.form.normalize("NFC"));
  assert.deepEqual(
    notCanonical
      .slice(0, 25)
      .map((row) => `form ${row.form_number} ${row.root} ${row.mood}/${row.person} ${describeArabic(row.form)}`),
    [],
    `${notCanonical.length} of ${rows.length} generated forms are not in NFC order`,
  );
});
