import { count, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { lexicalEntry } from "~/server/db/schema";

export const savedEntryColumns = {
  id: lexicalEntry.id,
  normalizedText: lexicalEntry.normalizedText,
};

export const countEntriesWithRoot = async (root: string | null) => {
  if (!root) {
    return 0;
  }
  const [result] = await db.select({ count: count() }).from(lexicalEntry).where(eq(lexicalEntry.root, root));
  return result?.count ?? 0;
};
