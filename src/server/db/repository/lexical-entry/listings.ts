import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { type LanguageType, lexicalEntry, morphPattern } from "~/server/db/schema";

const DEFAULT_LIMIT = 10;

const shuffle = <T>(items: readonly T[]): T[] =>
  items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);

export const getLexicalEntriesByRoot = async ({ root, page, limit }: { root: string; page: number; limit: number }) => {
  const [items, total] = await Promise.all([
    db.query.lexicalEntry.findMany({
      where: { root, isVerified: true },
      columns: { id: true, slug: true, text: true },
      orderBy: (entry) => [asc(entry.id)],
      limit,
      offset: (page - 1) * limit,
    }),
    db.$count(lexicalEntry, and(eq(lexicalEntry.root, root), eq(lexicalEntry.isVerified, true))),
  ]);

  return { items, total };
};

export const getRandomLexicalEntries = async (limit: number = DEFAULT_LIMIT) => {
  const sampled = await db.query.lexicalEntry.findMany({
    where: {
      RAW: (entry) =>
        sql`${entry.id} IN (SELECT id FROM lexical_entry TABLESAMPLE SYSTEM (10) WHERE is_verified = true)`,
    },
    orderBy: () => [sql`RANDOM()`],
    columns: { searchVector: false },
    limit,
  });

  if (sampled.length >= limit) {
    return sampled;
  }

  const startId = sql`(SELECT floor(random() * (max(id) + 1))::int FROM lexical_entry)`;
  const fromStartId = await db.query.lexicalEntry.findMany({
    where: { isVerified: true, RAW: (entry) => sql`${entry.id} >= ${startId}` },
    orderBy: (entry) => [asc(entry.id)],
    columns: { searchVector: false },
    limit,
  });

  if (fromStartId.length >= limit) {
    return shuffle(fromStartId);
  }

  const fromBeginning = await db.query.lexicalEntry.findMany({
    where: { isVerified: true },
    orderBy: (entry) => [asc(entry.id)],
    columns: { searchVector: false },
    limit,
  });
  const taken = new Set(fromStartId.map((entry) => entry.id));
  return shuffle([...fromStartId, ...fromBeginning.filter((entry) => !taken.has(entry.id))].slice(0, limit));
};

export const getRecentLexicalEntries = (limit: number = DEFAULT_LIMIT) => {
  return db.query.lexicalEntry.findMany({
    where: { isVerified: true },
    orderBy: (entry) => [desc(entry.createdAt), desc(entry.id)],
    columns: { searchVector: false },
    limit,
  });
};

export const getLexicalEntriesByLanguage = async ({
  language,
  page,
  limit,
}: {
  language: LanguageType;
  page: number;
  limit: number;
}) => {
  const [items, total] = await Promise.all([
    db.query.lexicalEntry.findMany({
      where: { language, isVerified: true },
      orderBy: (entry) => [desc(entry.createdAt), desc(entry.id)],
      columns: { searchVector: false },
      limit,
      offset: (page - 1) * limit,
    }),
    db.$count(lexicalEntry, and(eq(lexicalEntry.language, language), eq(lexicalEntry.isVerified, true))),
  ]);

  return { items, total };
};

export const getLexicalEntriesByFormNumber = async ({
  formNumber,
  radicalCount = 3,
  page,
  limit,
}: {
  formNumber: number;
  radicalCount?: number;
  page: number;
  limit: number;
}) => {
  const [items, total] = await Promise.all([
    db.query.lexicalEntry.findMany({
      where: { morphPattern: { formNumber, radicalCount }, isVerified: true },
      orderBy: (entry) => [asc(entry.id)],
      limit,
      offset: (page - 1) * limit,
      columns: { searchVector: false },
    }),
    db.$count(
      lexicalEntry,
      sql`${lexicalEntry.morphPatternId} IN (
        SELECT ${morphPattern.id} FROM ${morphPattern}
        WHERE ${morphPattern.formNumber} = ${formNumber} AND ${morphPattern.radicalCount} = ${radicalCount}
        ) AND ${lexicalEntry.isVerified} = true`,
    ),
  ]);

  return { items, total };
};
