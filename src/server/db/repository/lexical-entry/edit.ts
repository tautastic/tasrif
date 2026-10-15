import { asc, inArray, or } from "drizzle-orm";
import { db } from "~/server/db";
import { dedupeBy, invertRelationType } from "~/server/db/repository/sense/shared";
import { type SenseRelationType, senseRelation, translationLink } from "~/server/db/schema";

interface EditableTranslation {
  targetSenseId: number;
  domain: string | null;
  note: string | null;
}

interface EditableRelation {
  targetSenseId: number;
  relationType: SenseRelationType;
  contextNote: string | null;
  strength: number | null;
}

const appendTo = <T>(grouped: Map<number, T[]>, senseId: number, value: T) => {
  grouped.set(senseId, [...(grouped.get(senseId) ?? []), value]);
};

const getTranslationsBySense = async (senseIds: number[]) => {
  const grouped = new Map<number, EditableTranslation[]>();
  if (senseIds.length === 0) {
    return grouped;
  }

  const ids = new Set(senseIds);
  const rows = await db
    .select()
    .from(translationLink)
    .where(or(inArray(translationLink.enSenseId, senseIds), inArray(translationLink.arSenseId, senseIds)))
    .orderBy(asc(translationLink.id));

  for (const row of rows) {
    if (ids.has(row.enSenseId)) {
      appendTo(grouped, row.enSenseId, { targetSenseId: row.arSenseId, domain: row.domain, note: row.note });
    }
    if (ids.has(row.arSenseId)) {
      appendTo(grouped, row.arSenseId, { targetSenseId: row.enSenseId, domain: row.domain, note: row.note });
    }
  }

  return grouped;
};

const getRelationsBySense = async (senseIds: number[]) => {
  const grouped = new Map<number, EditableRelation[]>();
  if (senseIds.length === 0) {
    return grouped;
  }

  const ids = new Set(senseIds);
  const rows = await db
    .select()
    .from(senseRelation)
    .where(or(inArray(senseRelation.senseId1, senseIds), inArray(senseRelation.senseId2, senseIds)))
    .orderBy(asc(senseRelation.id));

  for (const row of rows) {
    if (ids.has(row.senseId1)) {
      appendTo(grouped, row.senseId1, {
        targetSenseId: row.senseId2,
        relationType: row.relationType,
        contextNote: row.contextNote,
        strength: row.strength,
      });
    }
    if (ids.has(row.senseId2)) {
      appendTo(grouped, row.senseId2, {
        targetSenseId: row.senseId1,
        relationType: invertRelationType(row.relationType),
        contextNote: row.contextNote,
        strength: row.strength,
      });
    }
  }

  for (const [senseId, relations] of grouped) {
    grouped.set(
      senseId,
      dedupeBy(relations, (relation) => `${relation.targetSenseId}:${relation.relationType}`),
    );
  }

  return grouped;
};

export const getLexicalEntryForEdit = async (id: number) => {
  const entry = await db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { searchVector: false },
    with: {
      morphPattern: {
        columns: { formNumber: true, radicalCount: true, perfectVowel: true, imperfectVowel: true },
      },
      senses: {
        orderBy: (sense) => [asc(sense.senseNumber)],
      },
    },
  });

  if (!entry) {
    return undefined;
  }

  const senseIds = entry.senses.map((sense) => sense.id);
  const [translations, relatedSenses] = await Promise.all([
    getTranslationsBySense(senseIds),
    getRelationsBySense(senseIds),
  ]);

  return {
    ...entry,
    senses: entry.senses.map((sense) => ({
      ...sense,
      translations: translations.get(sense.id) ?? [],
      relatedSenses: relatedSenses.get(sense.id) ?? [],
    })),
  };
};

export const getLexicalEntrySummary = (id: number) => {
  return db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { text: true, language: true },
  });
};
