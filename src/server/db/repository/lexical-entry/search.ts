import { asc, desc, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { plainTsQuery, textSearchConfigFor } from "~/server/db/repository/text-search";

const MAX_PREFIX_QUERY_LENGTH = 2;
const SIMILARITY_THRESHOLD = 0.3;
const WORD_SIMILARITY_THRESHOLD = 0.5;

export const searchLexicalEntries = async (rawQuery: string, limit: number, offset = 0) => {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }
  return Array.from(query).length <= MAX_PREFIX_QUERY_LENGTH
    ? prefixSearch(query, limit, offset)
    : fuzzySearch(query, limit, offset);
};

const normalizedQuery = (query: string) => sql`LOWER(REGEXP_REPLACE(${query}, '[[:punct:][:space:]ً-ٰٟؐ-ؚ]', '', 'g'))`;

const prefixSearch = (query: string, limit: number, offset: number) => {
  const normalized = normalizedQuery(query);

  return db.query.lexicalEntry.findMany({
    where: {
      RAW: (entry) =>
        sql`${entry.isVerified} = true AND ${normalized} <> '' AND ${entry.normalizedText} LIKE ${normalized} || '%'`,
    },
    orderBy: (entry) => [asc(sql`char_length(${entry.normalizedText})`), asc(entry.id)],
    columns: { searchVector: false },
    limit,
    offset,
  });
};

const fuzzySearch = (query: string, limit: number, offset: number) => {
  const normalized = normalizedQuery(query);
  const tsQuery = plainTsQuery(textSearchConfigFor(query), query);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('pg_trgm.similarity_threshold', ${String(SIMILARITY_THRESHOLD)}, true),
                 set_config('pg_trgm.word_similarity_threshold', ${String(WORD_SIMILARITY_THRESHOLD)}, true)`,
    );

    return tx.query.lexicalEntry.findMany({
      where: {
        RAW: (entry) => sql`${entry.isVerified} = true AND (
          ${entry.searchVector} @@ ${tsQuery}
          OR ${entry.normalizedText} % ${normalized}
          OR ${normalized} <% ${entry.normalizedText}
        )`,
      },
      orderBy: (entry) => [
        desc(sql`${entry.normalizedText} = ${normalized}`),
        desc(sql`ts_rank(${entry.searchVector}, ${tsQuery})`),
        desc(sql`similarity(${entry.normalizedText}, ${normalized})`),
        asc(entry.id),
      ],
      columns: { searchVector: false },
      limit,
      offset,
    });
  });
};
