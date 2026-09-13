import { asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { type LanguageType, lexicalEntry, morphPattern } from "~/server/db/schema";

const DEFAULT_LIMIT = 10;

export const getLexicalEntriesByRoot = (root: string) => {
  return db.query.lexicalEntry.findMany({
    where: { root },
    columns: { id: true, normalizedText: true, text: true },
    orderBy: (entry) => [asc(entry.id)],
  });
};

export const getRandomLexicalEntries = async (limit: number = DEFAULT_LIMIT) => {
  const sampled = await db.query.lexicalEntry.findMany({
    where: { RAW: (entry) => sql`${entry.id} IN (SELECT id FROM lexical_entry TABLESAMPLE SYSTEM (10))` },
    orderBy: () => [sql`RANDOM()`],
    columns: { searchVector: false },
    limit,
  });

  if (sampled.length >= limit) {
    return sampled;
  }

  return db.query.lexicalEntry.findMany({
    orderBy: () => [sql`RANDOM()`],
    columns: { searchVector: false },
    limit,
  });
};

export const getRecentLexicalEntries = (limit: number = DEFAULT_LIMIT) => {
  return db.query.lexicalEntry.findMany({
    orderBy: (entry) => [desc(entry.createdAt)],
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
  const [items, [totals]] = await Promise.all([
    db.query.lexicalEntry.findMany({
      where: { language },
      orderBy: (entry) => [desc(entry.createdAt)],
      columns: { searchVector: false },
      limit,
      offset: (page - 1) * limit,
    }),
    db.select({ count: count() }).from(lexicalEntry).where(eq(lexicalEntry.language, language)),
  ]);

  return { items, total: totals?.count ?? 0 };
};

export const getLexicalEntriesByFormNumber = async ({
  formNumber,
  page,
  limit,
}: {
  formNumber: number;
  page: number;
  limit: number;
}) => {
  const [items, total] = await Promise.all([
    db.query.lexicalEntry.findMany({
      where: { morphPattern: { formNumber } },
      orderBy: (entry) => [asc(entry.id)],
      limit,
      offset: (page - 1) * limit,
      columns: { searchVector: false },
    }),
    db.$count(
      lexicalEntry,
      sql`${lexicalEntry.morphPatternId} IN (
        SELECT ${morphPattern.id} FROM ${morphPattern} WHERE ${morphPattern.formNumber} = ${formNumber}
      )`,
    ),
  ]);

  return { items, total };
};
