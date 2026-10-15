import { and, asc, count, eq, isNull, ne, type SQL } from "drizzle-orm";
import { db } from "~/server/db";
import {
  lexicalEntry,
  lexicalPatternOverride,
  type MorphPatternInsert,
  morphPattern,
  morphPatternResolution,
  type RadicalKind,
  type ShortVowel,
} from "~/server/db/schema";

export type MorphPatternPersistable = Omit<MorphPatternInsert, "id" | "createdAt">;

export const MorphPatternLexicalFilterOptions = ["All", "Shape-resolved", "Lexical"] as const;
export type MorphPatternLexicalFilterValue = (typeof MorphPatternLexicalFilterOptions)[number];

export const listMorphPatternsForAdmin = async ({
  formNumber,
  radicalCount,
  lexicalFilter,
  page,
  limit,
}: {
  formNumber?: number;
  radicalCount?: number;
  lexicalFilter: MorphPatternLexicalFilterValue;
  page: number;
  limit: number;
}) => {
  const conditions: SQL[] = [];
  if (formNumber !== undefined) {
    conditions.push(eq(morphPattern.formNumber, formNumber));
  }
  if (radicalCount !== undefined) {
    conditions.push(eq(morphPattern.radicalCount, radicalCount));
  }
  if (lexicalFilter !== "All") {
    conditions.push(eq(morphPattern.isLexical, lexicalFilter === "Lexical"));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: morphPattern.id,
        formNumber: morphPattern.formNumber,
        radicalCount: morphPattern.radicalCount,
        vocalicTemplate: morphPattern.vocalicTemplate,
        description: morphPattern.description,
        noAffix: morphPattern.noAffix,
        isLexical: morphPattern.isLexical,
      })
      .from(morphPattern)
      .where(where)
      .orderBy(asc(morphPattern.formNumber), asc(morphPattern.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(morphPattern).where(where),
  ]);

  return { items, total: totalRow?.total ?? 0 };
};

export const getMorphPatternById = async (id: number) => {
  const [pattern] = await db.select().from(morphPattern).where(eq(morphPattern.id, id));
  return pattern ?? null;
};

export const getMorphPatternUsageCounts = async (id: number) => {
  const [[entryRow], [overrideRow]] = await Promise.all([
    db.select({ total: count() }).from(lexicalEntry).where(eq(lexicalEntry.morphPatternId, id)),
    db.select({ total: count() }).from(lexicalPatternOverride).where(eq(lexicalPatternOverride.morphPatternId, id)),
  ]);
  return { entryCount: entryRow?.total ?? 0, overrideCount: overrideRow?.total ?? 0 };
};

const vowelCondition = (
  column: typeof morphPatternResolution.perfectVowel | typeof morphPatternResolution.imperfectVowel,
  value: ShortVowel | null,
): SQL => (value === null ? isNull(column) : eq(column, value));

export interface MatchingKey {
  formNumber: number;
  radicalCount?: number;
  radical1Kind: RadicalKind;
  radical2Kind: RadicalKind;
  radical3Kind: RadicalKind;
  radical4Kind?: RadicalKind;
  isGeminate: boolean;
  perfectVowel: ShortVowel | null;
  imperfectVowel: ShortVowel | null;
}

export const findAmbiguousPattern = async (key: MatchingKey, excludeId?: number) => {
  const conditions = [
    eq(morphPatternResolution.formNumber, key.formNumber),
    eq(morphPatternResolution.radicalCount, key.radicalCount ?? 3),
    eq(morphPatternResolution.radical1Kind, key.radical1Kind),
    eq(morphPatternResolution.radical2Kind, key.radical2Kind),
    eq(morphPatternResolution.radical3Kind, key.radical3Kind),
    eq(morphPatternResolution.radical4Kind, key.radical4Kind ?? "sound"),
    eq(morphPatternResolution.isGeminate, key.isGeminate),
    vowelCondition(morphPatternResolution.perfectVowel, key.perfectVowel),
    vowelCondition(morphPatternResolution.imperfectVowel, key.imperfectVowel),
  ];
  if (excludeId !== undefined) {
    conditions.push(ne(morphPatternResolution.morphPatternId, excludeId));
  }

  const [match] = await db
    .select({ id: morphPattern.id, description: morphPattern.description })
    .from(morphPatternResolution)
    .innerJoin(morphPattern, eq(morphPattern.id, morphPatternResolution.morphPatternId))
    .where(and(...conditions))
    .orderBy(asc(morphPatternResolution.id))
    .limit(1);

  return match ?? null;
};

export const createMorphPattern = async (input: MorphPatternPersistable) => {
  const [created] = await db.insert(morphPattern).values(input).returning({ id: morphPattern.id });
  if (!created) {
    throw new Error("Failed to create morphological pattern");
  }
  return created;
};

export const updateMorphPattern = async (input: MorphPatternPersistable & { id: number }) => {
  const { id, ...values } = input;
  const [updated] = await db
    .update(morphPattern)
    .set(values)
    .where(eq(morphPattern.id, id))
    .returning({ id: morphPattern.id });
  return updated ?? null;
};

export const deleteMorphPatternById = async (id: number) => {
  const [deleted] = await db.delete(morphPattern).where(eq(morphPattern.id, id)).returning();
  return deleted ?? null;
};
