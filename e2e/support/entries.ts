import type { Db } from "../../tests/harness/client.ts";

export interface CreatedEntry {
  id: number;
  slug: string;
  senseId: number;
}

interface EnglishInput {
  text: string;
  pos?: string;
  definitions?: string[];
  verified?: boolean;
}

interface VerbInput {
  text: string;
  root: string;
  perfectVowel: string;
  imperfectVowel: string;
  definitions?: string[];
  verified?: boolean;
}

export const removeEntries = async (db: Db, ...texts: string[]): Promise<void> => {
  for (const text of texts) {
    await db.exec("DELETE FROM lexical_entry WHERE text = $1", [text]);
  }
};

const insertSense = (db: Db, entryId: number, pos: string, definitions: string[]): Promise<number> =>
  db.scalar<number>(
    `INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions)
     VALUES ($1, $2::pos_type, 1, ARRAY(SELECT jsonb_array_elements_text($3::jsonb)))
     RETURNING id`,
    [entryId, pos, JSON.stringify(definitions)],
  );

export const createEnglishEntry = async (db: Db, input: EnglishInput): Promise<CreatedEntry> => {
  await removeEntries(db, input.text);
  const entry = await db.one<{ id: number; slug: string }>(
    `INSERT INTO lexical_entry (language, text, is_verified) VALUES ('en', $1, $2) RETURNING id, slug`,
    [input.text, input.verified ?? true],
  );
  const senseId = await insertSense(
    db,
    entry.id,
    input.pos ?? "noun",
    input.definitions ?? [`${input.text} definition`],
  );
  return { id: entry.id, slug: entry.slug, senseId };
};

export const createArabicVerb = async (db: Db, input: VerbInput): Promise<CreatedEntry> => {
  await removeEntries(db, input.text);
  const entry = await db.one<{ id: number; slug: string }>(
    `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified)
     VALUES ('ar', $1, $2::varchar, resolve_morph_pattern_id($2::text, 1, $3::short_vowel, $4::short_vowel), $5)
     RETURNING id, slug`,
    [input.text, input.root, input.perfectVowel, input.imperfectVowel, input.verified ?? true],
  );
  const senseId = await insertSense(db, entry.id, "verb", input.definitions ?? ["to act"]);
  return { id: entry.id, slug: entry.slug, senseId };
};

export const entryExists = async (db: Db, id: number): Promise<boolean> =>
  (await db.scalar<number>("SELECT count(*)::int FROM lexical_entry WHERE id = $1", [id])) > 0;
