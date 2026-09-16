import type { Db, SqlParam } from "./client.ts";

export const PERSONS = [
  "first_person_singular",
  "second_person_masculine_singular",
  "second_person_feminine_singular",
  "third_person_masculine_singular",
  "third_person_feminine_singular",
  "second_person_dual",
  "third_person_masculine_dual",
  "third_person_feminine_dual",
  "first_person_plural",
  "second_person_masculine_plural",
  "second_person_feminine_plural",
  "third_person_masculine_plural",
  "third_person_feminine_plural",
] as const;

export const IMPERATIVE_PERSONS = [
  "second_person_masculine_singular",
  "second_person_feminine_singular",
  "second_person_dual",
  "second_person_masculine_plural",
  "second_person_feminine_plural",
] as const;

export const MOODS = [
  "perfect",
  "imperative",
  "imperfect_indicative",
  "imperfect_subjunctive",
  "imperfect_jussive",
] as const;

export type Person = (typeof PERSONS)[number];
export type Mood = (typeof MOODS)[number];
export type Paradigm = Partial<Record<Mood, Partial<Record<Person, string>>>>;

export interface PatternRow {
  id: number;
  form_number: number;
  description: string;
  vocalic_template: string;
  no_affix: boolean;
  radical1_kind: string;
  radical2_kind: string;
  radical3_kind: string;
  is_geminate: boolean;
  perfect_vowel: string | null;
  imperfect_vowel: string | null;
}

export interface VerbalNouns {
  masdar: string | null;
  active_participle: string | null;
  passive_participle: string | null;
}

const PATTERN_COLUMNS = `id, form_number, description, vocalic_template, no_affix,
  radical1_kind::text, radical2_kind::text, radical3_kind::text, is_geminate,
  perfect_vowel::text, imperfect_vowel::text`;

export const listPatterns = (db: Db): Promise<PatternRow[]> =>
  db.rows<PatternRow>(`SELECT ${PATTERN_COLUMNS} FROM morph_pattern ORDER BY form_number, id`);

export const findPattern = (db: Db, formNumber: number, description: string): Promise<PatternRow> =>
  db.one<PatternRow>(`SELECT ${PATTERN_COLUMNS} FROM morph_pattern WHERE form_number = $1 AND description = $2`, [
    formNumber,
    description,
  ]);

export const conjugate = async (
  db: Db,
  root: string,
  patternId: number,
  overrides: Record<string, SqlParam> = {},
): Promise<Paradigm> => {
  const rows = await db.rows<{ mood: Mood; person: Person; form: string }>(
    `SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
     FROM morph_pattern mp,
          LATERAL generate_conjugation_rows(
            $1, mp.rules, mp.form_number, $3::jsonb, mp.no_affix
          ) cr,
          LATERAL jsonb_each_text(cr.person_forms) kv
     WHERE mp.id = $2`,
    [root, patternId, JSON.stringify(overrides)],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

export const verbalNouns = (
  db: Db,
  root: string,
  patternId: number,
  overrides: Record<string, SqlParam> = {},
  noPassive = false,
): Promise<VerbalNouns> =>
  db.one<VerbalNouns>(
    `SELECT vn.masdar, vn.active_participle, vn.passive_participle
     FROM morph_pattern mp,
          LATERAL generate_verbal_nouns($1, mp.rules, mp.form_number, $3::jsonb, $4) vn
     WHERE mp.id = $2`,
    [root, patternId, JSON.stringify(overrides), noPassive],
  );

export const normalize = (db: Db, text: string): Promise<string> =>
  db.scalar<string>("SELECT normalize_arabic_orthography($1)", [text]);

export interface EntryInput {
  language?: string;
  text: string;
  root?: string | null;
  morphPatternId?: number | null;
  overrides?: Record<string, SqlParam> | null;
}

export const insertEntry = (db: Db, input: EntryInput): Promise<number> =>
  db.scalar<number>(
    `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, morphology_overrides)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [
      input.language ?? "ar",
      input.text,
      input.root ?? null,
      input.morphPatternId ?? null,
      input.overrides ? JSON.stringify(input.overrides) : null,
    ],
  );

export const storedParadigm = async (db: Db, entryId: number): Promise<Paradigm> => {
  const rows = await db.rows<{ mood: Mood; person: Person; form: string }>(
    "SELECT mood::text AS mood, person::text AS person, form FROM conjugation WHERE lexical_entry_id = $1",
    [entryId],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

export const storedStems = (db: Db, entryId: number): Promise<VerbalNouns & { latin_root: string | null }> =>
  db.one("SELECT masdar, active_participle, passive_participle, latin_root FROM lexical_entry WHERE id = $1", [
    entryId,
  ]);
