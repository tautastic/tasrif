import { eq } from "drizzle-orm";
import type { EntryFormValues } from "~/components/admin/entry-edit-form/schema";
import { db } from "~/server/db";
import { syncSenses } from "~/server/db/repository/sense";
import { lexicalEntry } from "~/server/db/schema";
import { savedEntryColumns } from "./shared";

export const createLexicalEntry = (input: EntryFormValues) => {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(lexicalEntry).values(input).returning(savedEntryColumns);
    if (!created) {
      throw new Error("Failed to create lexical entry");
    }
    await syncSenses(tx, created.id, input.language, input.senses);
    return created;
  });
};

export const updateLexicalEntry = (input: EntryFormValues & { id: number }) => {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(lexicalEntry)
      .set(input)
      .where(eq(lexicalEntry.id, input.id))
      .returning(savedEntryColumns);
    if (!updated) {
      return null;
    }
    await syncSenses(tx, updated.id, input.language, input.senses);
    return updated;
  });
};

export const deleteLexicalEntryById = async (entryId: number) => {
  await db.delete(lexicalEntry).where(eq(lexicalEntry.id, entryId));
};
