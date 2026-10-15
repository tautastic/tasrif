import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { type LexicalPatternOverrideInsert, lexicalPatternOverride } from "~/server/db/schema";

export type LexicalPatternOverridePersistable = Omit<LexicalPatternOverrideInsert, "id" | "createdAt">;

export const listOverridesForPattern = (morphPatternId: number) =>
  db
    .select()
    .from(lexicalPatternOverride)
    .where(eq(lexicalPatternOverride.morphPatternId, morphPatternId))
    .orderBy(
      asc(lexicalPatternOverride.root),
      sql`${lexicalPatternOverride.variant} asc nulls first`,
      asc(lexicalPatternOverride.id),
    );

export const getOverrideById = async (id: number) => {
  const [override] = await db.select().from(lexicalPatternOverride).where(eq(lexicalPatternOverride.id, id));
  return override ?? null;
};

export const createOverride = async (input: LexicalPatternOverridePersistable) => {
  const [created] = await db.insert(lexicalPatternOverride).values(input).returning({ id: lexicalPatternOverride.id });
  if (!created) {
    throw new Error("Failed to create pattern override");
  }
  return created;
};

export const updateOverride = async (input: LexicalPatternOverridePersistable & { id: number }) => {
  const { id, morphPatternId, root, formNumber, perfectVowel, imperfectVowel, variant, note } = input;
  const [updated] = await db
    .update(lexicalPatternOverride)
    .set({ root, formNumber, perfectVowel, imperfectVowel, variant: variant ?? null, note: note ?? null })
    .where(and(eq(lexicalPatternOverride.id, id), eq(lexicalPatternOverride.morphPatternId, morphPatternId)))
    .returning({ id: lexicalPatternOverride.id });
  return updated ?? null;
};

export const deleteOverrideById = async (id: number, morphPatternId: number) => {
  const [deleted] = await db
    .delete(lexicalPatternOverride)
    .where(and(eq(lexicalPatternOverride.id, id), eq(lexicalPatternOverride.morphPatternId, morphPatternId)))
    .returning();
  return deleted ?? null;
};
