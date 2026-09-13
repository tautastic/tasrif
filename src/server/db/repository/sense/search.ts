import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { SenseSearchResponse } from "~/lib/api/sense-search";
import { db } from "~/server/db";
import { type LanguageType, lexicalEntry, sense } from "~/server/db/schema";

export const searchSenses = async ({
  query,
  language,
  page = 1,
  limit = 20,
}: {
  query: string;
  language?: LanguageType;
  page?: number;
  limit?: number;
}): Promise<SenseSearchResponse> => {
  const searchTerm = query.trim();
  if (!searchTerm) {
    return { items: [], hasMore: false };
  }

  const tsQuery = sql`plainto_tsquery('simple', ${searchTerm})`;
  const matchesQuery = sql`${lexicalEntry.searchVector} @@ ${tsQuery}`;

  const rows = await db
    .select({
      id: sense.id,
      text: lexicalEntry.text,
      pos: sense.pos,
      language: lexicalEntry.language,
    })
    .from(sense)
    .innerJoin(lexicalEntry, eq(sense.lexicalEntryId, lexicalEntry.id))
    .where(language ? and(matchesQuery, eq(lexicalEntry.language, language)) : matchesQuery)
    .orderBy(
      desc(sql`ts_rank(${lexicalEntry.searchVector}, ${tsQuery})`),
      asc(lexicalEntry.text),
      asc(sense.pos),
      asc(sense.id),
    )
    .limit(limit + 1)
    .offset((page - 1) * limit);

  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
};

export const getSensesByIds = async (ids: number[]) => {
  if (ids.length === 0) {
    return [];
  }

  return db
    .select({
      id: sense.id,
      text: lexicalEntry.text,
      pos: sense.pos,
      language: lexicalEntry.language,
    })
    .from(sense)
    .innerJoin(lexicalEntry, eq(sense.lexicalEntryId, lexicalEntry.id))
    .where(inArray(sense.id, ids))
    .orderBy(asc(lexicalEntry.text), asc(sense.pos), asc(sense.id));
};
