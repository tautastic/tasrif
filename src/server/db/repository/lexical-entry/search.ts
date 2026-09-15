import { desc, sql } from "drizzle-orm";
import { db } from "~/server/db";

const MIN_FULL_TEXT_LENGTH = 3;
const TRIGRAM_THRESHOLD = 0.2;

export const searchLexicalEntries = async (rawQuery: string, limit: number) => {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }
  return query.length < MIN_FULL_TEXT_LENGTH ? trigramSearch(query, limit) : fullTextSearch(query, limit);
};

const fullTextSearch = (query: string, limit: number) => {
  const tsQuery = sql`plainto_tsquery('arabic', ${query})`;

  return db.query.lexicalEntry.findMany({
    where: { RAW: (entry) => sql`${entry.searchVector} @@ ${tsQuery} AND ${entry.isVerified} = true` },
    orderBy: (entry) => [desc(sql`ts_rank(${entry.searchVector}, ${tsQuery})`)],
    columns: { searchVector: false },
    limit,
  });
};

const similarityExpr = (entry: { text: unknown; normalizedText: unknown }, query: string) => sql<number>`GREATEST(
    similarity(${entry.text}, ${query}),
similarity(${entry.normalizedText}, ${query})
)`;

const trigramSearch = (query: string, limit: number) => {
  return db.query.lexicalEntry.findMany({
    where: {
      RAW: (entry) => sql`${similarityExpr(entry, query)} >= ${TRIGRAM_THRESHOLD} AND ${entry.isVerified} = true`,
    },
    orderBy: (entry) => [desc(similarityExpr(entry, query))],
    columns: { searchVector: false },
    limit,
  });
};
