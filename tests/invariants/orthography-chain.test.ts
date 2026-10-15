import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOT_SAMPLES } from "../fixtures/roots.ts";
import { openDatabase } from "../harness";

const db = await openDatabase();

const ALPHABET = [
  "ء",
  "آ",
  "أ",
  "ؤ",
  "إ",
  "ئ",
  "ا",
  "و",
  "ي",
  "ى",
  "ی",
  "ك",
  "ت",
  "ب",
  "م",
  "ـ",
  "ً",
  "َ",
  "ُ",
  "ِ",
  "ّ",
  "ْ",
  " ",
];

const randomStrings = (count: number, seed: number): string[] => {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state;
  };
  const strings: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const length = 1 + (next() % 12);
    let value = "";
    for (let position = 0; position < length; position += 1) {
      value += ALPHABET[next() % ALPHABET.length];
    }
    strings.push(value);
  }
  return strings;
};

const FULL_CHAIN = `normalize_arabic_long_vowels(
  normalize_arabic_hamza_assimilation(
    normalize_arabic_hamza_seating_after_alif(
      normalize_arabic_hamza_seating_alif(
        normalize_arabic_hamza_seating_waw_yeh(
          normalize_arabic_hamza_seating_bare(
            normalize_arabic_initial_hamza(
              normalize_arabic_gemination(
                normalize_arabic_alef_maqsura(
                  normalize_arabic_remove_tatweel(input)))))))))) `;

const disagreements = (inputs: string[]) =>
  db.rows<{ input: string; actual: string; expected: string }>(
    `SELECT input, actual, expected
     FROM (SELECT input, normalize_arabic_orthography(input) AS actual, ${FULL_CHAIN} AS expected
           FROM jsonb_array_elements_text($1::jsonb) AS inputs(input)
           OFFSET 0) AS compared
     WHERE actual IS DISTINCT FROM expected`,
    [JSON.stringify(inputs)],
  );

test("normalize_arabic_orthography equals the full chain of its steps on random strings", async () => {
  const inputs = randomStrings(5000, 20261013);
  assert.ok(inputs.some((value) => /[ء-ئ]/.test(value)));
  assert.ok(inputs.some((value) => !/[ء-ئ]/.test(value)));
  assert.deepEqual(await disagreements(inputs), []);
});

test("normalize_arabic_orthography equals the full chain of its steps on every raw form the patterns produce", async () => {
  const roots = [...new Set([...ROOT_SAMPLES.map((sample) => sample.root), "صبر", "زهر", "ذكر", "ثبت", "وأد", "بئس"])];
  const raw = await db.column<string>(
    `WITH roots AS (SELECT jsonb_array_elements_text($1::jsonb) AS root),
     pieces AS (
       SELECT mp.form_number, k AS mood_key, jsonb_typeof(mp.rules -> k) = 'object' AS per_person, t.key AS person,
              CASE WHEN jsonb_typeof(mp.rules -> k) = 'object' THEN t.value ELSE mp.rules ->> k END AS template
       FROM morph_pattern mp
       CROSS JOIN LATERAL jsonb_object_keys(mp.rules) k
       LEFT JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(mp.rules -> k) = 'object'
                                              THEN mp.rules -> k ELSE '{}'::jsonb END) t ON TRUE
     ),
     affixed AS (
       SELECT p.template
       FROM pieces p
       WHERE p.mood_key IN ('masdar', 'active_participle', 'passive_participle')
       UNION ALL
       SELECT CASE WHEN p.mood_key LIKE 'imperfect%' THEN a.prefix ELSE '' END || p.template ||
              CASE WHEN p.mood_key LIKE 'imperfect%' OR NOT p.per_person THEN a.suffix ELSE '' END
       FROM pieces p
       JOIN affix_rules a
         ON a.form = CASE WHEN p.mood_key LIKE 'imperfect%' THEN p.form_number ELSE 0 END
        AND (a.mood::text = p.mood_key OR (p.mood_key = 'imperfect_stem' AND a.mood::text LIKE 'imperfect%'))
        AND (p.person IS NULL OR p.person = a.person::text)
     )
     SELECT DISTINCT replace_root_placeholders(a.template, substr(r.root, 1, 1), substr(r.root, 2, 1), substr(r.root, 3, 1))
     FROM affixed a CROSS JOIN roots r
     WHERE a.template IS NOT NULL`,
    [JSON.stringify(roots)],
  );
  assert.ok(raw.length > 1000, `only ${raw.length} raw forms`);
  for (let start = 0; start < raw.length; start += 5000) {
    assert.deepEqual(await disagreements(raw.slice(start, start + 5000)), []);
  }
});
