import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  assertSqlState,
  findPattern,
  IMPERATIVE_PERSONS,
  MOODS,
  openDatabase,
  PERSONS,
} from "../harness";

const db = await openDatabase();

const IMPERFECT_MOODS = ["imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"];
const DAMMA_PREFIX_FORMS = [2, 3, 4];
const FATHA = "َ";
const DAMMA = "ُ";

const describeRows = (rows: Record<string, unknown>[]) => rows.map((row) => JSON.stringify(row)).join("\n");

const assertNoRows = (rows: Record<string, unknown>[], what: string) => {
  assert.equal(rows.length, 0, `${what}\n${describeRows(rows)}`);
};

test("perfect and imperative affixes live under form 0 and never carry a prefix", async () => {
  const wrongForm = await db.rows<{ mood: string; form: number }>(
    `SELECT DISTINCT mood::text AS mood, form FROM affix_rules
     WHERE mood IN ('perfect', 'imperative') AND form <> 0 ORDER BY 1, 2`,
  );
  assertNoRows(wrongForm, "generate_conjugation_rows always looks these up with form 0");

  const withPrefix = await db.rows<{ mood: string; person: string; prefix: string }>(
    `SELECT mood::text AS mood, person::text AS person, prefix FROM affix_rules
     WHERE mood IN ('perfect', 'imperative') AND coalesce(prefix, '') <> '' ORDER BY 1, 2`,
  );
  assertNoRows(withPrefix, "the perfect and imperative are built from suffixes alone");
});

test("imperfect affixes never live under form 0", async () => {
  const rows = await db.rows<{ mood: string; form: number }>(
    `SELECT DISTINCT mood::text AS mood, form FROM affix_rules
     WHERE mood <> ALL (ARRAY['perfect', 'imperative']::affix_mood[]) AND form = 0 ORDER BY 1`,
  );
  assertNoRows(rows, "the imperfect moods are looked up with the pattern form number");
});

test("each mood and form carries exactly the person set that mood requires", async () => {
  const groups = await db.rows<{ mood: string; form: number; persons: string[] }>(
    `SELECT mood::text AS mood, form, array_agg(person::text ORDER BY person::text) AS persons
     FROM affix_rules GROUP BY mood, form ORDER BY form, mood`,
  );
  assert.ok(groups.length > 0, "affix_rules is empty");

  const expectedFor = (mood: string) => (mood === "imperative" ? [...IMPERATIVE_PERSONS].sort() : [...PERSONS].sort());

  for (const group of groups) {
    assert.ok((MOODS as readonly string[]).includes(group.mood), `affix_rules holds an unknown mood ${group.mood}`);
    assert.deepEqual(
      group.persons,
      expectedFor(group.mood),
      `mood ${group.mood} form ${group.form} has the wrong person set`,
    );
  }
});

test("no duplicate rule for the same mood, person and form", async () => {
  const rows = await db.rows<{ mood: string; person: string; form: number; total: string }>(
    `SELECT mood::text AS mood, person::text AS person, form, count(*)::text AS total
     FROM affix_rules GROUP BY mood, person, form HAVING count(*) > 1`,
  );
  assertNoRows(rows, "build_person_forms would emit the same cell twice");
});

test("every pattern that relies on affixes has imperfect rules for its form number", async () => {
  const rows = await db.rows<{ form_number: number; description: string; mood: string }>(
    `SELECT mp.form_number, mp.description, m AS mood
     FROM morph_pattern mp, LATERAL unnest($1::text[]) m
     WHERE NOT mp.no_affix
       AND NOT EXISTS (
         SELECT 1 FROM affix_rules a WHERE a.form = mp.form_number AND a.mood::text = m
       )
     ORDER BY mp.form_number, m`,
    [`{${IMPERFECT_MOODS.join(",")}}`],
  );
  assertNoRows(rows, "a missing (mood, form) pair makes build_person_forms return an empty paradigm silently");
});

test("imperfect prefixes use the vowel class their form requires", async () => {
  const rows = await db.rows<{ form: number; mood: string; person: string; prefix: string }>(
    `SELECT form, mood::text AS mood, person::text AS person, prefix
     FROM affix_rules
     WHERE mood::text = ANY ($1::text[])
     ORDER BY form, mood, person`,
    [`{${IMPERFECT_MOODS.join(",")}}`],
  );
  assert.ok(rows.length > 0, "no imperfect affix rules found");

  const wrong = rows.filter((row) => {
    const expectedVowel = DAMMA_PREFIX_FORMS.includes(row.form) ? DAMMA : FATHA;
    return !row.prefix.endsWith(expectedVowel);
  });
  assertNoRows(
    wrong,
    "forms II, III and IV take a damma imperfect prefix and every other form takes a fatha; " +
      "a wrong vowel here silently mis-conjugates an entire form",
  );
});

test("imperfect suffixes are identical across every form number", async () => {
  const rows = await db.rows<{ mood: string; person: string; form: number; suffix: string; base: string }>(
    `SELECT a.mood::text AS mood, a.person::text AS person, a.form, a.suffix, b.suffix AS base
     FROM affix_rules a
     JOIN affix_rules b ON b.form = 1 AND b.mood = a.mood AND b.person = a.person
     WHERE a.form <> 1
       AND a.mood::text = ANY ($1::text[])
       AND a.suffix IS DISTINCT FROM b.suffix
     ORDER BY a.form, a.mood, a.person`,
    [`{${IMPERFECT_MOODS.join(",")}}`],
  );
  assertNoRows(rows, "only the prefix vowel varies between forms; the mood endings are shared");
});

test("prefixes differ from form I exactly where the vowel class differs", async () => {
  const rows = await db.rows<{ form: number; differing: string }>(
    `SELECT a.form, count(*)::text AS differing
     FROM affix_rules a
     JOIN affix_rules b ON b.form = 1 AND b.mood = a.mood AND b.person = a.person
     WHERE a.form <> 1
       AND a.mood::text = ANY ($1::text[])
       AND a.prefix IS DISTINCT FROM b.prefix
     GROUP BY a.form ORDER BY a.form`,
    [`{${IMPERFECT_MOODS.join(",")}}`],
  );
  const differingForms = rows.map((row) => row.form).sort((left, right) => left - right);
  assert.deepEqual(
    differingForms,
    DAMMA_PREFIX_FORMS,
    "only forms II, III and IV should diverge from the form I prefixes",
  );
  for (const row of rows) {
    assert.equal(
      Number(row.differing),
      IMPERFECT_MOODS.length * PERSONS.length,
      `form ${row.form} should differ from form I in every imperfect cell`,
    );
  }
});

test("prefix and suffix are NOT NULL and default to the empty string", async () => {
  const columns = await db.rows<{ column_name: string; is_nullable: string; column_default: string | null }>(
    `SELECT column_name, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'affix_rules' AND column_name IN ('prefix', 'suffix')
     ORDER BY column_name`,
  );
  assert.deepEqual(
    columns.map((column) => [column.column_name, column.is_nullable, column.column_default]),
    [
      ["prefix", "NO", "''::text"],
      ["suffix", "NO", "''::text"],
    ],
  );
});

test("a NULL affix cannot be stored", async () => {
  await db.tx(async (tx) => {
    const prefix = await tx.failure(
      `INSERT INTO affix_rules (mood, person, form, prefix, suffix)
       VALUES ('perfect', 'first_person_singular', 99, NULL, '')`,
    );
    assertSqlState(prefix, "23502");

    const suffix = await tx.failure(
      `INSERT INTO affix_rules (mood, person, form, prefix, suffix)
       VALUES ('perfect', 'first_person_singular', 99, '', NULL)`,
    );
    assertSqlState(suffix, "23502");
  });
});

test("a missing affix is treated as empty instead of voiding the whole mood", async () => {
  const pattern = await findPattern(db, 1, "a ~ u");
  await db.tx(async (tx) => {
    await tx.exec("ALTER TABLE affix_rules ALTER COLUMN prefix DROP NOT NULL");
    await tx.exec("ALTER TABLE affix_rules ALTER COLUMN suffix DROP NOT NULL");
    await tx.exec(
      `UPDATE affix_rules SET prefix = NULL
       WHERE mood = 'imperfect_indicative' AND person = 'first_person_singular' AND form = 1`,
    );
    await tx.exec(
      `UPDATE affix_rules SET suffix = NULL
       WHERE mood = 'perfect' AND person = 'first_person_singular' AND form = 0`,
    );

    const rows = await tx.rows<{ mood: string; person: string; form: string }>(
      `SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
       FROM morph_pattern mp,
            LATERAL generate_conjugation_rows($1, mp.rules, mp.form_number, '{}'::jsonb, mp.no_affix) cr,
            LATERAL jsonb_each_text(cr.person_forms) kv
       WHERE mp.id = $2`,
      ["كتب", pattern.id],
    );
    const countFor = (mood: string) => rows.filter((row) => row.mood === mood).length;
    assert.equal(countFor("perfect"), 13);
    assert.equal(countFor("imperfect_indicative"), 13);

    const cellFor = (mood: string, person: string) =>
      rows.find((row) => row.mood === mood && row.person === person)?.form ?? null;
    assertArabicEqual(cellFor("imperfect_indicative", "first_person_singular"), "كْتُبُ", "prefix treated as empty");
    assertArabicEqual(cellFor("perfect", "first_person_singular"), "كَتَب", "suffix treated as empty");
  });
});

test("forms III and IV repeat the form II imperfect affixes row for row", async () => {
  const rows = await db.rows<{ form: number; mood: string; person: string; detail: string }>(
    `SELECT copy.form, base.mood::text AS mood, base.person::text AS person,
            CASE WHEN alias.id IS NULL THEN 'missing' ELSE 'differs' END AS detail
     FROM affix_rules base
     CROSS JOIN (VALUES (3), (4)) AS copy(form)
     LEFT JOIN affix_rules alias
       ON alias.form = copy.form AND alias.mood = base.mood AND alias.person = base.person
     WHERE base.form = 2
       AND (alias.id IS NULL OR alias.prefix IS DISTINCT FROM base.prefix OR alias.suffix IS DISTINCT FROM base.suffix)
     UNION ALL
     SELECT extra.form, extra.mood::text, extra.person::text, 'extra'
     FROM affix_rules extra
     WHERE extra.form IN (3, 4)
       AND NOT EXISTS (SELECT 1 FROM affix_rules base
                       WHERE base.form = 2 AND base.mood = extra.mood AND base.person = extra.person)
     ORDER BY 1, 2, 3`,
  );
  assertNoRows(
    rows,
    "forms II, III and IV share the damma imperfect prefixes; the duplicated rows of forms III and IV must stay copies of form II",
  );
});
