import { asc, count, desc, eq, getColumns, sql } from "drizzle-orm";
import type { EntryFormValues } from "~/components/admin/entry-edit-form/schema";
import { db } from "~/server/db";
import { syncSenses } from "~/server/db/repository/sense";
import { type LanguageType, type LexicalEntrySelect, lexicalEntry, morphPattern } from "~/server/db/schema";

const DEFAULT_LIMIT = 10;
const TRIGRAM_THRESHOLD = 0.2;
const MIN_FULL_TEXT_LENGTH = 3;

const { searchVector: _searchVector, ...entryColumns } = getColumns(lexicalEntry);

export const searchLexicalEntries = async (
  rawQuery: string,
  limit: number = DEFAULT_LIMIT,
): Promise<LexicalEntrySelect[]> => {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }
  return query.length < MIN_FULL_TEXT_LENGTH ? trigramSearch(query, limit) : fullTextSearch(query, limit);
};

const fullTextSearch = (query: string, limit: number): Promise<LexicalEntrySelect[]> => {
  const tsQuery = sql`plainto_tsquery('arabic', ${query})`;

  return db
    .select(entryColumns)
    .from(lexicalEntry)
    .where(sql`${lexicalEntry.searchVector} @@ ${tsQuery}`)
    .orderBy(desc(sql`ts_rank(${lexicalEntry.searchVector}, ${tsQuery})`))
    .limit(limit);
};

const trigramSearch = (query: string, limit: number): Promise<LexicalEntrySelect[]> => {
  const similarity = sql<number>`GREATEST(
    similarity(${lexicalEntry.text}, ${query}),
  similarity(${lexicalEntry.normalizedText}, ${query})
  )`;

  return db
    .select(entryColumns)
    .from(lexicalEntry)
    .where(sql`${similarity} >= ${TRIGRAM_THRESHOLD}`)
    .orderBy(desc(similarity))
    .limit(limit);
};

export const getLexicalEntriesByRoot = (root: string) => {
  return db.query.lexicalEntry.findMany({
    where: { root },
    columns: { id: true, normalizedText: true, text: true },
    orderBy: (entry) => [asc(entry.id)],
  });
};

export const getRandomLexicalEntries = async (limit: number = DEFAULT_LIMIT): Promise<LexicalEntrySelect[]> => {
  const sampled = await db
    .select(entryColumns)
    .from(lexicalEntry)
    .where(sql`${lexicalEntry.id} IN (SELECT id FROM lexical_entry TABLESAMPLE SYSTEM (10))`)
    .orderBy(sql`RANDOM()`)
    .limit(limit);

  if (sampled.length >= limit) {
    return sampled;
  }

  return db.select(entryColumns).from(lexicalEntry).orderBy(sql`RANDOM()`).limit(limit);
};

export const getRecentLexicalEntries = (limit: number = DEFAULT_LIMIT): Promise<LexicalEntrySelect[]> => {
  return db.select(entryColumns).from(lexicalEntry).orderBy(desc(lexicalEntry.createdAt)).limit(limit);
};

const countEntriesWithRoot = async (root: string | null): Promise<number> => {
  if (!root) {
    return 0;
  }
  const [result] = await db.select({ count: count() }).from(lexicalEntry).where(eq(lexicalEntry.root, root));
  return result?.count ?? 0;
};

export const getLexicalEntryByNormalizedText = async (normalizedText: string) => {
  const entries = await db.query.lexicalEntry.findMany({
    where: { normalizedText },
    columns: { searchVector: false },
    with: {
      morphPattern: {
        columns: { formNumber: true, description: true },
      },
      senses: {
        with: { translations: true, relatedSenses: true },
        orderBy: (senses, { sql }) => [sql`${senses.senseNumber}`],
      },
      conjugations: true,
    },
    orderBy: (lexicalEntry, { sql }) => [
      sql`case when ${lexicalEntry.morphPatternId} is null then 1 else 0 end`,
      sql`coalesce(
        (select ${morphPattern.formNumber}
      from ${morphPattern}
      where ${morphPattern.id} = ${lexicalEntry.morphPatternId}),
      ${lexicalEntry.id}
      )`,
      sql`${lexicalEntry.id}`,
    ],
  });

  const first = entries[0];
  if (!first) {
    return null;
  }

  return {
    language: first.language,
    rootInfo: {
      arabic: first.root,
      latin: first.latinRoot,
      count: await countEntriesWithRoot(first.root),
    },
    entries,
  };
};

export type EntryPageData = NonNullable<Awaited<ReturnType<typeof getLexicalEntryByNormalizedText>>>;
export type EntryPageEntry = EntryPageData["entries"][number];
export type EntryPageSense = EntryPageEntry["senses"][number];
export type EntryRootInfo = EntryPageData["rootInfo"];

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
    db
      .select(entryColumns)
      .from(lexicalEntry)
      .where(eq(lexicalEntry.language, language))
      .orderBy(desc(lexicalEntry.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: count() }).from(lexicalEntry).where(eq(lexicalEntry.language, language)),
  ]);

  return { items, total: totals?.count ?? 0 };
};

export const getLexicalEntryForEdit = (id: number) => {
  return db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { searchVector: false },
    with: {
      senses: {
        with: { translations: true, relatedSenses: true },
        orderBy: (sense) => [asc(sense.senseNumber)],
      },
    },
  });
};

export const getLexicalEntrySummary = (id: number) => {
  return db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { text: true, language: true },
  });
};

const toEntryValues = (input: EntryFormValues) => ({
  language: input.language,
  text: input.text,
  root: input.root,
  morphPatternId: input.morphPatternId,
  morphologyOverrides: input.morphologyOverrides,
});

export interface SavedLexicalEntry {
  id: number;
  normalizedText: string;
}

const savedEntryColumns = {
  id: lexicalEntry.id,
  normalizedText: lexicalEntry.normalizedText,
};

export const createLexicalEntry = (input: EntryFormValues): Promise<SavedLexicalEntry> => {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(lexicalEntry).values(toEntryValues(input)).returning(savedEntryColumns);
    if (!created) {
      throw new Error("Failed to create lexical entry");
    }
    await syncSenses(tx, created.id, input.language, input.senses);
    return created;
  });
};

export const updateLexicalEntry = (input: EntryFormValues & { id: number }): Promise<SavedLexicalEntry | null> => {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(lexicalEntry)
      .set(toEntryValues(input))
      .where(eq(lexicalEntry.id, input.id))
      .returning(savedEntryColumns);
    if (!updated) {
      return null;
    }
    await syncSenses(tx, updated.id, input.language, input.senses);
    return updated;
  });
};

export const deleteLexicalEntryById = async (entryId: number): Promise<void> => {
  await db.delete(lexicalEntry).where(eq(lexicalEntry.id, entryId));
};
