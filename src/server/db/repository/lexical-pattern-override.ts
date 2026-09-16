import { asc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { type LexicalPatternOverrideInsert, lexicalPatternOverride } from "~/server/db/schema";

export type LexicalPatternOverridePersistable = Omit<LexicalPatternOverrideInsert, "id" | "createdAt">;

export const listOverridesForPattern = (morphPatternId: number) =>
  db
    .select()
    .from(lexicalPatternOverride)
    .where(eq(lexicalPatternOverride.morphPatternId, morphPatternId))
    .orderBy(asc(lexicalPatternOverride.root), asc(lexicalPatternOverride.id));

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
  const { id, ...values } = input;
  const [updated] = await db
    .update(lexicalPatternOverride)
    .set(values)
    .where(eq(lexicalPatternOverride.id, id))
    .returning({ id: lexicalPatternOverride.id });
  return updated ?? null;
};

export const deleteOverrideById = async (id: number) => {
  const [deleted] = await db.delete(lexicalPatternOverride).where(eq(lexicalPatternOverride.id, id)).returning();
  return deleted ?? null;
};
