import { eq, inArray, or, sql } from "drizzle-orm";
import type { SenseParseOutputType } from "~/components/admin/entry-edit-form/schema";
import type { DbTransaction } from "~/server/db";
import { type LanguageType, sense, senseRelation, translationLink } from "~/server/db/schema";
import { DEFAULT_RELATION_STRENGTH, dedupeBy, type SavedSense } from "./shared";

const upsertSenses = async (
  tx: DbTransaction,
  entryId: number,
  senses: SenseParseOutputType[],
): Promise<SavedSense[]> => {
  const existing = await tx.query.sense.findMany({
    where: { lexicalEntryId: entryId },
    columns: { id: true },
  });
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
    .returning({ id: sense.id, senseNumber: sense.senseNumber });

  if (rows.length !== senses.length) {
    throw new Error("Sense upsert returned an unexpected number of rows");
  }

  const idBySenseNumber = new Map(rows.map((row) => [row.senseNumber, row.id]));

  return senses.map((input) => {
    const id = idBySenseNumber.get(input.senseNumber);
    if (id === undefined) {
      throw new Error(`Sense upsert did not return a row for sense number ${input.senseNumber}`);
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
) => {
  const saved = await upsertSenses(tx, entryId, senses);
  await replaceTranslations(tx, entryLanguage, saved);
  await replaceRelations(tx, saved);
};
