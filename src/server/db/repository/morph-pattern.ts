import { and, asc, count, eq, sql } from "drizzle-orm";
import { resolveVerbFormChoice, type VerbFormChoice } from "~/lib/validation/verbFormChoice";
import { db } from "~/server/db";
import { lexicalEntry, morphPattern } from "~/server/db/schema";

export const getVerbFormsWithCounts = async () => {
  const rows = await db
    .select({
      formNumber: morphPattern.formNumber,
      total: count(lexicalEntry.id),
    })
    .from(morphPattern)
    .leftJoin(lexicalEntry, and(eq(lexicalEntry.morphPatternId, morphPattern.id), eq(lexicalEntry.isVerified, true)))
    .groupBy(morphPattern.formNumber)
    .orderBy(asc(morphPattern.formNumber));

  return rows.filter((row) => row.total > 0);
};

const INVALID_ROOT_SQLSTATE = "22023";

const isInvalidRootError = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === INVALID_ROOT_SQLSTATE &&
  "message" in error &&
  typeof (error as { message: unknown }).message === "string";

export interface RootClassification {
  labels: string[] | null;
  rootError: string | null;
}

export const describeVerbRoot = async (root: string): Promise<RootClassification> => {
  try {
    const result = await db.execute<{ describe_root: string[] }>(sql`SELECT describe_root(${root}) AS describe_root`);
    return { labels: result.rows[0]?.describe_root ?? null, rootError: null };
  } catch (error) {
    if (isInvalidRootError(error)) {
      return { labels: null, rootError: error.message };
    }
    throw error;
  }
};

export interface ResolvedMorphPattern {
  id: number;
  description: string;
  vocalicTemplate: string;
}

export const resolveVerbMorphPattern = async (
  root: string,
  choice: VerbFormChoice,
): Promise<ResolvedMorphPattern | null> => {
  const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);

  const result = await db.execute<{ id: number; description: string; vocalic_template: string }>(sql`
    SELECT id, description, vocalic_template
    FROM morph_pattern
    WHERE id = resolve_morph_pattern_id(${root}, ${formNumber}, ${perfectVowel}, ${imperfectVowel})
  `);

  const row = result.rows[0];
  return row ? { id: row.id, description: row.description, vocalicTemplate: row.vocalic_template } : null;
};
