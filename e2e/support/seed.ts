import type { Db } from "../../tests/harness/client.ts";
import { ENGLISH, FORM_I_PARTICIPLE_CASE, FORM_VIII_CASES, WORDS } from "./data.ts";

export interface SeedIds {
  entries: Record<string, number>;
  slugs: Record<string, string>;
  senses: Record<string, number>;
  patterns: Record<string, number>;
  overrides: Record<string, number>;
}

interface EntryInput {
  key: string;
  language: "ar" | "en";
  text: string;
  root?: string;
  form?: { formNumber: number; perfectVowel?: string; imperfectVowel?: string };
  verified?: boolean;
  overrides?: Record<string, string>;
  pos: string;
  definitions: string[];
  examples?: string[];
}

const jsonList = (values: string[]): string => JSON.stringify(values);

export const seedDatabase = async (db: Db): Promise<SeedIds> => {
  const ids: SeedIds = { entries: {}, slugs: {}, senses: {}, patterns: {}, overrides: {} };

  const addEntry = async (input: EntryInput): Promise<void> => {
    const patternId = input.form
      ? await db.scalar<number | null>("SELECT resolve_morph_pattern_id($1, $2, $3::short_vowel, $4::short_vowel)", [
          input.root,
          input.form.formNumber,
          input.form.perfectVowel ?? null,
          input.form.imperfectVowel ?? null,
        ])
      : null;
    if (input.form && patternId === null) {
      throw new Error(`No pattern resolves for ${input.text}`);
    }
    const entry = await db.one<{ id: number; slug: string }>(
      `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified, morphology_overrides)
       VALUES ($1::lang_type, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, slug`,
      [
        input.language,
        input.text,
        input.root ?? null,
        patternId,
        input.verified ?? true,
        input.overrides ? JSON.stringify(input.overrides) : null,
      ],
    );
    const senseId = await db.scalar<number>(
      `INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions, examples)
       VALUES ($1, $2::pos_type, 1,
               ARRAY(SELECT jsonb_array_elements_text($3::jsonb)),
               ARRAY(SELECT jsonb_array_elements_text($4::jsonb)))
       RETURNING id`,
      [entry.id, input.pos, jsonList(input.definitions), jsonList(input.examples ?? [])],
    );
    ids.entries[input.key] = entry.id;
    ids.slugs[input.key] = entry.slug;
    ids.senses[input.key] = senseId;
  };

  await addEntry({
    key: "book",
    language: "en",
    text: ENGLISH.book,
    pos: "noun",
    definitions: ["a bound set of pages"],
    overrides: { plural_form: "books" },
  });
  await addEntry({
    key: "toWrite",
    language: "en",
    text: ENGLISH.toWrite,
    pos: "verb",
    definitions: ["to form letters or words on a surface"],
  });
  await addEntry({
    key: "kataba",
    language: "ar",
    text: WORDS.kataba.text,
    root: WORDS.kataba.root,
    form: { formNumber: 1, perfectVowel: "a", imperfectVowel: "u" },
    pos: "verb",
    definitions: ["to write", "to inscribe"],
    examples: ["كَتَبَ الطَّالِبُ الدَّرْسَ"],
  });
  await addEntry({
    key: "kitab",
    language: "ar",
    text: WORDS.kitab.text,
    root: WORDS.kitab.root,
    pos: "noun",
    definitions: ["book"],
    overrides: { plural_form: "كُتُب", dual_form: "كِتَابَانِ" },
  });
  await addEntry({
    key: "kuttab",
    language: "ar",
    text: WORDS.kuttab.text,
    root: WORDS.kuttab.root,
    pos: "noun",
    definitions: ["writers, clerks"],
  });
  await addEntry({
    key: "qala",
    language: "ar",
    text: WORDS.qala.text,
    root: WORDS.qala.root,
    form: { formNumber: 1, perfectVowel: "a", imperfectVowel: "u" },
    pos: "verb",
    definitions: ["to say"],
  });
  await addEntry({
    key: "hasiba",
    language: "ar",
    text: FORM_I_PARTICIPLE_CASE.text,
    root: FORM_I_PARTICIPLE_CASE.root,
    form: { formNumber: 1, perfectVowel: "i", imperfectVowel: "i" },
    pos: "verb",
    definitions: [FORM_I_PARTICIPLE_CASE.gloss],
  });
  for (const formEight of FORM_VIII_CASES) {
    await addEntry({
      key: `form8-${formEight.root}`,
      language: "ar",
      text: formEight.text,
      root: formEight.root,
      form: { formNumber: 8 },
      pos: "verb",
      definitions: [formEight.gloss],
    });
  }
  await addEntry({
    key: "draft",
    language: "ar",
    text: WORDS.draft.text,
    root: WORDS.draft.root,
    pos: "noun",
    definitions: ["a preliminary version of a text"],
    verified: false,
  });
  await addEntry({
    key: "broken",
    language: "ar",
    text: WORDS.broken.text,
    root: "ترج",
    form: { formNumber: 1, perfectVowel: "a", imperfectVowel: "u" },
    pos: "verb",
    definitions: ["to translate"],
  });

  await db.exec("SET session_replication_role = replica");
  try {
    await db.exec(
      `UPDATE lexical_entry
       SET root = $2, masdar = NULL, active_participle = NULL, passive_participle = NULL
       WHERE id = $1`,
      [ids.entries.broken, WORDS.broken.root],
    );
    await db.exec("DELETE FROM conjugation WHERE lexical_entry_id = $1", [ids.entries.broken]);
  } finally {
    await db.exec("SET session_replication_role = DEFAULT");
  }

  const link = (english: string, arabic: string, rank: number, domain: string | null, note: string | null) =>
    db.exec(
      `INSERT INTO translation_link (en_sense_id, ar_sense_id, frequency_rank, domain, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [ids.senses[english], ids.senses[arabic], rank, domain, note],
    );
  await link("book", "kitab", 5, "general", null);
  await link("book", "kuttab", 2, "literary", "second book");
  await link("toWrite", "kataba", 5, null, null);
  await db.exec(
    `INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type, strength)
     VALUES ($1, $2, 'near_synonym', 5)`,
    [ids.senses.kitab, ids.senses.kataba],
  );

  ids.patterns.editor = await db.scalar<number>(
    `INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, is_lexical, perfect_vowel, imperfect_vowel)
     SELECT 1, vocalic_template, 'test only, pattern editor', rules, TRUE, 'u', 'i'
     FROM morph_pattern WHERE code = 'f1-a-u'
     RETURNING id`,
  );
  ids.patterns.inUse = await db.scalar<number>("SELECT id FROM morph_pattern WHERE code = 'f1-a-u'");
  ids.overrides.editor = await db.scalar<number>(
    `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
     VALUES ('رأي', 1, 'u', 'i', $1, 'test only, seeded override')
     RETURNING id`,
    [ids.patterns.editor],
  );

  return ids;
};
