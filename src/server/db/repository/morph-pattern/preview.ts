import { sql } from "drizzle-orm";
import type { MorphPatternRules } from "~/lib/validation/morphPatternRules";
import { db } from "~/server/db";

export interface PreviewInput {
  root: string;
  rules: MorphPatternRules;
  formNumber: number;
  noAffix: boolean;
}

export type PreviewParadigmCell = {
  mood: string;
  person: string;
  form: string;
};

export const previewConjugation = async ({
  root,
  rules,
  formNumber,
  noAffix,
}: PreviewInput): Promise<PreviewParadigmCell[]> => {
  const result = await db.execute<PreviewParadigmCell>(sql`
    SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
    FROM generate_conjugation_rows(${root}, ${JSON.stringify(rules)}::jsonb, ${formNumber}, '{}'::jsonb, ${noAffix}) cr,
         LATERAL jsonb_each_text(cr.person_forms) kv
  `);
  return result.rows;
};

export type PreviewVerbalNouns = {
  masdar: string | null;
  active_participle: string | null;
  passive_participle: string | null;
};

export const previewVerbalNouns = async ({
  root,
  rules,
  formNumber,
}: Omit<PreviewInput, "noAffix">): Promise<PreviewVerbalNouns> => {
  const result = await db.execute<PreviewVerbalNouns>(sql`
    SELECT vn.masdar, vn.active_participle, vn.passive_participle
    FROM generate_verbal_nouns(${root}, ${JSON.stringify(rules)}::jsonb, ${formNumber}, '{}'::jsonb, FALSE) vn
  `);
  return result.rows[0] ?? { masdar: null, active_participle: null, passive_participle: null };
};
