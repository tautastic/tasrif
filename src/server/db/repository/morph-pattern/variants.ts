import { sql } from "drizzle-orm";
import { resolveVerbFormChoice, type VerbFormChoice } from "~/lib/validation/verbFormChoice";
import { db } from "~/server/db";

export interface MorphPatternVariant {
  id: number;
  code: string;
  description: string;
  vocalicTemplate: string;
  variant: string | null;
  note: string | null;
  isDefault: boolean;
  sample: string | null;
}

interface VariantRow extends Record<string, unknown> {
  morph_pattern_id: number;
  code: string;
  description: string;
  vocalic_template: string;
  variant: string | null;
  note: string | null;
  is_default: boolean;
  sample: string | null;
}

export const listMorphPatternVariants = async (
  root: string,
  choice: VerbFormChoice,
): Promise<MorphPatternVariant[]> => {
  const { formNumber, perfectVowel, imperfectVowel, radicalCount } = resolveVerbFormChoice(choice);
  const result = await db.execute<VariantRow>(sql`
    SELECT morph_pattern_id, code, description, vocalic_template, variant, note, is_default, sample
    FROM morph_pattern_variants(${root}, ${formNumber}, ${perfectVowel}, ${imperfectVowel}, ${radicalCount})
  `);
  return result.rows.map((row) => ({
    id: row.morph_pattern_id,
    code: row.code,
    description: row.description,
    vocalicTemplate: row.vocalic_template,
    variant: row.variant,
    note: row.note,
    isDefault: row.is_default,
    sample: row.sample,
  }));
};

export const isMorphPatternChoiceAllowed = async (
  root: string,
  choice: VerbFormChoice,
  patternId: number,
): Promise<boolean> => {
  const { formNumber, perfectVowel, imperfectVowel, radicalCount } = resolveVerbFormChoice(choice);
  const result = await db.execute<{ allowed: boolean }>(sql`
    SELECT morph_pattern_choice_allowed(${root}, ${formNumber}, ${perfectVowel}, ${imperfectVowel}, ${patternId}, ${radicalCount}) AS allowed
  `);
  return result.rows[0]?.allowed === true;
};

export const getEntryMorphPatternId = async (entryId: number): Promise<number | null> => {
  const result = await db.execute<{ morph_pattern_id: number | null }>(sql`
    SELECT morph_pattern_id FROM lexical_entry WHERE id = ${entryId}
  `);
  return result.rows[0]?.morph_pattern_id ?? null;
};
