import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { SenseParseOutputType } from "~/components/admin/entry-edit-form/schema";
import type { SenseSearchOption, SenseSearchResponse } from "~/lib/api/sense-search";
import { type DbTransaction, db } from "~/server/db";
import { type LanguageType, lexicalEntry, sense, senseRelation, translationLink } from "~/server/db/schema";

const DEFAULT_RELATION_STRENGTH = 5;

interface SavedSense {
  id: number;
  input: SenseParseOutputType;
}

const dedupeBy = <T>(items: readonly T[], keyOf: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const upsertSenses = async (
  tx: DbTransaction,
  entryId: number,
  senses: SenseParseOutputType[],
): Promise<SavedSense[]> => {
  const existing = await tx.select({ id: sense.id }).from(sense).where(eq(sense.lexicalEntryId, entryId));
  const incomingIds = new Set(senses.map((s) => s.id));
  const staleIds = existing.map((row) => row.id).filter((id) => !incomingIds.has(id));

  if (staleIds.length > 0) {
    await tx.delete(sense).where(inArray(sense.id, staleIds));
  }

  if (senses.length === 0) {
    return [];
  }

  if (existing.length > 0) {
    await tx
      .update(sense)
      .set({ senseNumber: sql`-${sense.id}` })
      .where(eq(sense.lexicalEntryId, entryId));
  }

  const rows = await tx
    .insert(sense)
    .values(
      senses.map((s) => ({
        id: s.id,
        lexicalEntryId: entryId,
        pos: s.pos,
        senseNumber: s.senseNumber,
        definitions: s.definitions,
        examples: s.examples ?? [],
      })),
    )
    .onConflictDoUpdate({
      target: sense.id,
      set: {
        pos: sql`excluded.pos`,
        senseNumber: sql`excluded.sense_number`,
        definitions: sql`excluded.definitions`,
        examples: sql`excluded.examples`,
      },
    })
    .returning({ id: sense.id });

  if (rows.length !== senses.length) {
    throw new Error("Sense upsert returned an unexpected number of rows");
  }

  return senses.map((input, index) => {
    const id = rows[index]?.id;
    if (id === undefined || (input.id !== undefined && input.id !== id)) {
      throw new Error("Sense upsert returned rows out of order");
    }
    return { id, input };
  });
};

const replaceTranslations = async (tx: DbTransaction, entryLanguage: LanguageType, saved: SavedSense[]) => {
  const senseIds = saved.map((s) => s.id);
  if (senseIds.length === 0) {
    return;
  }

  await tx
    .delete(translationLink)
    .where(or(inArray(translationLink.enSenseId, senseIds), inArray(translationLink.arSenseId, senseIds)));

  const values = saved.flatMap(({ id, input }) =>
    dedupeBy(input.translations ?? [], (tr) => String(tr.targetSenseId)).map((tr) => ({
      enSenseId: entryLanguage === "en" ? id : tr.targetSenseId,
      arSenseId: entryLanguage === "ar" ? id : tr.targetSenseId,
      domain: tr.domain,
      note: tr.note,
    })),
  );

  if (values.length > 0) {
    await tx.insert(translationLink).values(values);
  }
};

const replaceRelations = async (tx: DbTransaction, saved: SavedSense[]) => {
  const senseIds = saved.map((s) => s.id);
  if (senseIds.length === 0) {
    return;
  }

  await tx
    .delete(senseRelation)
    .where(or(inArray(senseRelation.senseId1, senseIds), inArray(senseRelation.senseId2, senseIds)));

  const values = saved.flatMap(({ id, input }) => {
    const relations = (input.relatedSenses ?? []).filter((rel) => rel.targetSenseId !== id);
    return dedupeBy(relations, (rel) => `${rel.targetSenseId}:${rel.relationType}`).map((rel) => ({
      senseId1: id,
      senseId2: rel.targetSenseId,
      relationType: rel.relationType,
      contextNote: rel.contextNote,
      strength: rel.strength ?? DEFAULT_RELATION_STRENGTH,
    }));
  });

  if (values.length > 0) {
    await tx.insert(senseRelation).values(values);
  }
};

export const syncSenses = async (
  tx: DbTransaction,
  entryId: number,
  entryLanguage: LanguageType,
  senses: SenseParseOutputType[],
): Promise<void> => {
  const saved = await upsertSenses(tx, entryId, senses);
  await replaceTranslations(tx, entryLanguage, saved);
  await replaceRelations(tx, saved);
};

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

export const getSensesByIds = async (ids: number[]): Promise<SenseSearchOption[]> => {
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
