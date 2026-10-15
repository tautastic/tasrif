import { eq, inArray, or, sql } from "drizzle-orm";
import type { SenseParseOutputType } from "~/components/admin/entry-edit-form/schema";
import type { DbTransaction } from "~/server/db";
import {
  type LanguageType,
  type SenseRelationType,
  sense,
  senseRelation,
  type TranslationLinkInsert,
  translationLink,
} from "~/server/db/schema";
import { blankToNull, DEFAULT_RELATION_STRENGTH, dedupeBy, invertRelationType, type SavedSense } from "./shared";

const sameTags = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((tag, index) => tag === b[index]);

const upsertSenses = async (
  tx: DbTransaction,
  entryId: number,
  senses: SenseParseOutputType[],
): Promise<SavedSense[]> => {
  const existing = await tx.query.sense.findMany({
    where: { lexicalEntryId: entryId },
    columns: { id: true, contextTags: true },
  });
  const existingTags = new Map(existing.map((row) => [row.id, row.contextTags]));
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
        contextTags: s.contextTags,
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
      setWhere: eq(sense.lexicalEntryId, entryId),
    })
    .returning({ id: sense.id, senseNumber: sense.senseNumber });

  if (rows.length !== senses.length) {
    throw new Error("Sense upsert returned an unexpected number of rows");
  }

  const idBySenseNumber = new Map(rows.map((row) => [row.senseNumber, row.id]));

  const saved = senses.map((input) => {
    const id = idBySenseNumber.get(input.senseNumber);
    if (id === undefined) {
      throw new Error(`Sense upsert did not return a row for sense number ${input.senseNumber}`);
    }
    return { id, input };
  });

  for (const { id, input } of saved) {
    const current = existingTags.get(id);
    if (input.contextTags !== undefined && current !== undefined && !sameTags(current, input.contextTags)) {
      await tx.update(sense).set({ contextTags: input.contextTags }).where(eq(sense.id, id));
    }
  }

  return saved;
};

const syncTranslations = async (tx: DbTransaction, entryLanguage: LanguageType, saved: SavedSense[]) => {
  const senseIds = saved.map((s) => s.id);
  if (senseIds.length === 0) {
    return;
  }

  const existing = await tx
    .select()
    .from(translationLink)
    .where(or(inArray(translationLink.enSenseId, senseIds), inArray(translationLink.arSenseId, senseIds)));

  const deleteIds: number[] = [];
  const inserts: TranslationLinkInsert[] = [];
  const updates: { id: number; domain: string | null; note: string | null }[] = [];

  for (const { id, input } of saved) {
    const targetOf = (row: (typeof existing)[number]) => (row.enSenseId === id ? row.arSenseId : row.enSenseId);
    const current = existing.filter((row) => row.enSenseId === id || row.arSenseId === id);
    const currentByTarget = new Map(current.map((row) => [targetOf(row), row]));
    const desired = dedupeBy(input.translations ?? [], (tr) => String(tr.targetSenseId));
    const desiredTargets = new Set(desired.map((tr) => tr.targetSenseId));

    deleteIds.push(...current.filter((row) => !desiredTargets.has(targetOf(row))).map((row) => row.id));

    for (const tr of desired) {
      const domain = blankToNull(tr.domain);
      const note = blankToNull(tr.note);
      const row = currentByTarget.get(tr.targetSenseId);
      if (!row) {
        inserts.push({
          enSenseId: entryLanguage === "en" ? id : tr.targetSenseId,
          arSenseId: entryLanguage === "ar" ? id : tr.targetSenseId,
          domain,
          note,
        });
      } else if (blankToNull(row.domain) !== domain || blankToNull(row.note) !== note) {
        updates.push({ id: row.id, domain, note });
      }
    }
  }

  if (deleteIds.length > 0) {
    await tx.delete(translationLink).where(inArray(translationLink.id, deleteIds));
  }
  if (inserts.length > 0) {
    await tx.insert(translationLink).values(inserts);
  }
  for (const { id, domain, note } of updates) {
    await tx.update(translationLink).set({ domain, note }).where(eq(translationLink.id, id));
  }
};

interface DesiredRelation {
  senseId1: number;
  senseId2: number;
  relationType: SenseRelationType;
  contextNote: string | null;
  strength: number;
}

const relationKey = (senseId1: number, senseId2: number, relationType: SenseRelationType) =>
  senseId1 < senseId2
    ? `${senseId1}:${senseId2}:${relationType}`
    : `${senseId2}:${senseId1}:${invertRelationType(relationType)}`;

const syncRelations = async (tx: DbTransaction, saved: SavedSense[]) => {
  const senseIds = saved.map((s) => s.id);
  if (senseIds.length === 0) {
    return;
  }

  const existing = await tx
    .select()
    .from(senseRelation)
    .where(or(inArray(senseRelation.senseId1, senseIds), inArray(senseRelation.senseId2, senseIds)));

  const desired = new Map<string, DesiredRelation>();
  for (const { id, input } of saved) {
    const relations = (input.relatedSenses ?? []).filter((rel) => rel.targetSenseId !== id);
    for (const rel of dedupeBy(relations, (r) => `${r.targetSenseId}:${r.relationType}`)) {
      const key = relationKey(id, rel.targetSenseId, rel.relationType);
      if (!desired.has(key)) {
        desired.set(key, {
          senseId1: id,
          senseId2: rel.targetSenseId,
          relationType: rel.relationType,
          contextNote: blankToNull(rel.contextNote),
          strength: rel.strength ?? DEFAULT_RELATION_STRENGTH,
        });
      }
    }
  }

  const currentByKey = new Map<string, (typeof existing)[number][]>();
  for (const row of existing) {
    const key = relationKey(row.senseId1, row.senseId2, row.relationType);
    currentByKey.set(key, [...(currentByKey.get(key) ?? []), row]);
  }

  const deleteIds = existing
    .filter((row) => !desired.has(relationKey(row.senseId1, row.senseId2, row.relationType)))
    .map((row) => row.id);
  const inserts = [...desired].filter(([key]) => !currentByKey.has(key)).map(([, relation]) => relation);
  const updates = [...desired].flatMap(([key, relation]) =>
    (currentByKey.get(key) ?? [])
      .filter(
        (row) =>
          blankToNull(row.contextNote) !== relation.contextNote ||
          (row.strength ?? DEFAULT_RELATION_STRENGTH) !== relation.strength,
      )
      .map((row) => ({ id: row.id, contextNote: relation.contextNote, strength: relation.strength })),
  );

  if (deleteIds.length > 0) {
    await tx.delete(senseRelation).where(inArray(senseRelation.id, deleteIds));
  }
  if (inserts.length > 0) {
    await tx.insert(senseRelation).values(inserts);
  }
  for (const { id, contextNote, strength } of updates) {
    await tx.update(senseRelation).set({ contextNote, strength }).where(eq(senseRelation.id, id));
  }
};

export const syncSenses = async (
  tx: DbTransaction,
  entryId: number,
  entryLanguage: LanguageType,
  senses: SenseParseOutputType[],
) => {
  const saved = await upsertSenses(tx, entryId, senses);
  await syncTranslations(tx, entryLanguage, saved);
  await syncRelations(tx, saved);
};
