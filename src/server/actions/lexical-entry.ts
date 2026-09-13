"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  type EntryCreateType,
  type EntryEditType,
  entryCreateSchema,
  entryEditSchema,
} from "~/components/admin/entry-edit-form/schema";
import { requireAdminAction } from "~/server/auth/guard";
import { createLexicalEntry, deleteLexicalEntryById, updateLexicalEntry } from "~/server/db/repository/lexical-entry";

const parseOrThrow = <S extends z.ZodType>(schema: S, data: unknown): z.output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`Invalid entry data — ${details.join("; ")}`);
  }
  return result.data;
};

export async function createLexicalEntryAction(data: EntryCreateType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryCreateSchema, data);
  return createLexicalEntry(entry);
}

export async function updateLexicalEntryAction(data: EntryEditType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryEditSchema, data);

  const updated = await updateLexicalEntry({ ...entry, id: entry.id });
  if (!updated) {
    throw new Error(`Lexical entry ${entry.id} no longer exists`);
  }
  return updated;
}

export async function deleteLexicalEntryAction(id: number) {
  await requireAdminAction();
  await deleteLexicalEntryById(id);
  redirect("/");
}
