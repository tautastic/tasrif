import assert from "node:assert/strict";
import { test } from "node:test";
import { IMPERATIVE_PERSONS, openDatabase, PERSONS } from "../harness";

const db = await openDatabase();

const MOOD_KEYS = ["perfect", "imperative", "imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"];
const STEM_KEY = "imperfect_stem";
const STRING_KEYS = ["masdar", "active_participle", "passive_participle"];
const ALLOWED_KEYS = [...STRING_KEYS, ...MOOD_KEYS, STEM_KEY];
const SUPPORTED_FORM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const toJsonParam = (values: readonly string[] | readonly number[]) => JSON.stringify(values);

const describeRows = (rows: Record<string, unknown>[]) => rows.map((row) => JSON.stringify(row)).join("\n");

const assertNoRows = (rows: Record<string, unknown>[], what: string) => {
  assert.equal(rows.length, 0, `${what}\n${describeRows(rows)}`);
};

test("every pattern carries at least one mood and the seed set is present", async () => {
  const total = Number(await db.scalar<string>("SELECT count(*)::text FROM morph_pattern"));
  assert.ok(total >= 27, `expected at least the 27 seeded patterns, found ${total}`);

  const rows = await db.rows<{ form_number: number; description: string }>(
    `SELECT form_number, description FROM morph_pattern mp
     WHERE NOT EXISTS (
       SELECT 1 FROM jsonb_object_keys(mp.rules) k
       WHERE k = ANY (SELECT jsonb_array_elements_text($1::jsonb))
     )`,
    [toJsonParam([...MOOD_KEYS, STEM_KEY])],
  );
  assertNoRows(rows, "patterns with no mood or stem key would generate an empty paradigm");
});

test("rules use only keys that generate_conjugation_rows understands", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string }>(
    `SELECT mp.form_number, mp.description, k AS key
     FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
     WHERE k <> ALL (SELECT jsonb_array_elements_text($1::jsonb))
     ORDER BY mp.form_number, k`,
    [toJsonParam(ALLOWED_KEYS)],
  );
  assertNoRows(rows, "unknown rule keys are silently ignored by the generator");
});

test("rules is always a json object", async () => {
  const rows = await db.rows<{ form_number: number; description: string; kind: string }>(
    "SELECT form_number, description, jsonb_typeof(rules) AS kind FROM morph_pattern WHERE jsonb_typeof(rules) <> 'object'",
  );
  assertNoRows(rows, "rules must be an object");
});

test("no pattern combines imperfect_stem with an explicit imperfect mood", async () => {
  const rows = await db.rows<{ form_number: number; description: string }>(
    `SELECT form_number, description FROM morph_pattern
     WHERE rules ? 'imperfect_stem'
       AND (rules ? 'imperfect_indicative' OR rules ? 'imperfect_subjunctive' OR rules ? 'imperfect_jussive')
     ORDER BY form_number`,
  );
  assertNoRows(rows, "both branches would fire and the winner would depend on jsonb key order");
});

test("templates reference only the three radical placeholders", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string; template: string }>(
    `WITH templates AS (
       SELECT mp.form_number, mp.description, k AS key,
              CASE WHEN jsonb_typeof(mp.rules -> k) = 'object'
                   THEN (SELECT string_agg(value, ' ') FROM jsonb_each_text(mp.rules -> k))
                   ELSE mp.rules ->> k END AS template
       FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
     )
     SELECT form_number, description, key, template FROM templates
     WHERE template ~ '\\{[^123]\\}' OR template ~ '\\{[0-9]{2,}\\}'
     ORDER BY form_number, key`,
  );
  assertNoRows(rows, "only {1} {2} {3} are substituted by replace_root_placeholders");
});

test("verbal noun keys are always plain strings", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string; kind: string }>(
    `SELECT mp.form_number, mp.description, k AS key, jsonb_typeof(mp.rules -> k) AS kind
     FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
     WHERE k = ANY (SELECT jsonb_array_elements_text($1::jsonb))
       AND jsonb_typeof(mp.rules -> k) <> 'string'
     ORDER BY mp.form_number, k`,
    [toJsonParam(STRING_KEYS)],
  );
  assertNoRows(rows, "generate_verbal_nouns reads these with #>> '{}' and expects a scalar");
});

test("object-valued moods carry exactly the person set their mood requires", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string; persons: number }>(
    `SELECT mp.form_number, mp.description, k AS key,
            (SELECT count(*) FROM jsonb_object_keys(mp.rules -> k))::int AS persons
     FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
     WHERE jsonb_typeof(mp.rules -> k) = 'object'
       AND (SELECT count(*) FROM jsonb_object_keys(mp.rules -> k))
           <> CASE WHEN k = 'imperative' THEN $1::int ELSE $2::int END
     ORDER BY mp.form_number, k`,
    [IMPERATIVE_PERSONS.length, PERSONS.length],
  );
  assertNoRows(rows, "a missing person key silently drops that cell from the paradigm");
});

test("every person key in an object-valued mood is a real person_type", async () => {
  const rows = await db.rows<{ form_number: number; key: string; person: string }>(
    `SELECT DISTINCT mp.form_number, k AS key, pk AS person
     FROM morph_pattern mp,
          LATERAL jsonb_object_keys(mp.rules) k,
          LATERAL jsonb_object_keys(mp.rules -> k) pk
     WHERE jsonb_typeof(mp.rules -> k) = 'object'
       AND pk <> ALL (SELECT unnest(enum_range(NULL::person_type))::text)
     ORDER BY mp.form_number, k, pk`,
  );
  assertNoRows(rows, "an unknown person key never reaches the conjugation table");
});

test("object-valued imperative uses only the five imperative persons", async () => {
  const rows = await db.rows<{ form_number: number; description: string; person: string }>(
    `SELECT mp.form_number, mp.description, pk AS person
     FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules -> 'imperative') pk
     WHERE jsonb_typeof(mp.rules -> 'imperative') = 'object'
       AND pk <> ALL (SELECT jsonb_array_elements_text($1::jsonb))
     ORDER BY mp.form_number, pk`,
    [toJsonParam(IMPERATIVE_PERSONS)],
  );
  assertNoRows(rows, "the imperative only exists for the second person");
});

test("no_affix patterns spell every mood out per person", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string; kind: string }>(
    `SELECT mp.form_number, mp.description, k AS key, jsonb_typeof(mp.rules -> k) AS kind
     FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
     WHERE mp.no_affix
       AND k = ANY (SELECT jsonb_array_elements_text($1::jsonb))
       AND jsonb_typeof(mp.rules -> k) <> 'object'
     ORDER BY mp.form_number, k`,
    [toJsonParam([...MOOD_KEYS, STEM_KEY])],
  );
  assertNoRows(
    rows,
    "under no_affix a string template is replicated verbatim across all 13 persons, which is never a real paradigm",
  );
});

test("an object-valued perfect or imperative spells the person out in full", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string; person: string }>(
    `SELECT mp.form_number, mp.description, k AS key, pk AS person
     FROM morph_pattern mp,
          LATERAL jsonb_object_keys(mp.rules) k,
          LATERAL jsonb_object_keys(mp.rules -> k) pk
     WHERE NOT mp.no_affix
       AND k IN ('perfect', 'imperative')
       AND jsonb_typeof(mp.rules -> k) = 'object'
       AND (mp.rules -> k ->> pk) = ''
     ORDER BY mp.form_number, k, pk`,
  );
  assertNoRows(
    rows,
    "build_person_forms appends no suffix to an object template, so each cell must already be a complete word",
  );
});

test("form numbers and the form I vowel constraint hold", async () => {
  const unsupported = await db.rows<{ form_number: number; description: string }>(
    `SELECT form_number, description FROM morph_pattern
     WHERE form_number <> ALL (SELECT jsonb_array_elements_text($1::jsonb)::int)
     ORDER BY form_number`,
    [toJsonParam(SUPPORTED_FORM_NUMBERS)],
  );
  assertNoRows(unsupported, "unsupported form number");

  const badVowels = await db.rows<{ form_number: number; description: string }>(
    `SELECT form_number, description FROM morph_pattern
     WHERE (form_number = 1) <> (perfect_vowel IS NOT NULL AND imperfect_vowel IS NOT NULL)
     ORDER BY form_number`,
  );
  assertNoRows(badVowels, "form I needs both vowels and the other forms need neither");
});

test("a shape-resolvable pattern spells out every hamza radical in every rule it carries", async () => {
  const rows = await db.rows<{ form_number: number; description: string; key: string; slot: number }>(
    `WITH hamza_slots AS (
       SELECT mp.id, mp.form_number, mp.description, s.slot
       FROM morph_pattern mp,
            LATERAL (VALUES (1, mp.radical1_kind), (2, mp.radical2_kind), (3, mp.radical3_kind)) AS s(slot, kind)
       WHERE NOT mp.is_lexical AND s.kind = 'hamza'
     ), templates AS (
       SELECT mp.id, k AS key,
              CASE WHEN jsonb_typeof(mp.rules -> k) = 'object'
                   THEN (SELECT string_agg(value, ' ') FROM jsonb_each_text(mp.rules -> k))
                   ELSE mp.rules ->> k END AS template
       FROM morph_pattern mp, LATERAL jsonb_object_keys(mp.rules) k
     )
     SELECT h.form_number, h.description, t.key, h.slot
     FROM hamza_slots h JOIN templates t ON t.id = h.id
     WHERE POSITION('{' || h.slot || '}' IN t.template) = 0
     ORDER BY h.form_number, h.slot, t.key`,
  );
  assertNoRows(
    rows,
    "a hamza radical is an ordinary consonant, so a pattern reached by root shape must write it in every form. " +
      "Only a named verb elides it, and such a pattern belongs behind is_lexical",
  );
});

test("every lexical pattern is reachable through at least one override", async () => {
  const rows = await db.rows<{ form_number: number; description: string }>(
    `SELECT mp.form_number, mp.description
     FROM morph_pattern mp
     WHERE mp.is_lexical
       AND NOT EXISTS (SELECT 1 FROM lexical_pattern_override o WHERE o.morph_pattern_id = mp.id)
     ORDER BY mp.form_number, mp.id`,
  );
  assertNoRows(
    rows,
    "resolve_morph_pattern_id skips lexical patterns, so one with no override row can never reach an entry",
  );
});
