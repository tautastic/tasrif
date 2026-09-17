import { and, count, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { lexicalEntry } from "~/server/db/schema";

export const savedEntryColumns = {
  id: lexicalEntry.id,
  normalizedText: lexicalEntry.normalizedText,
  isVerified: lexicalEntry.isVerified,
};

export const entryMorphPatternSummaryColumns = { formNumber: true, description: true } as const;
export const senseWithTranslationsAndRelations = { translations: true, relatedSenses: true } as const;

export const countEntriesWithRoot = async (root: string | null) => {
  if (!root) {
    return 0;
  }
  const [result] = await db
    .select({ count: count() })
    .from(lexicalEntry)
    .where(and(eq(lexicalEntry.root, root), eq(lexicalEntry.isVerified, true)));
  return result?.count ?? 0;
};
