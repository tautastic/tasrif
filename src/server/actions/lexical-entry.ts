"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  type EntryCreateType,
  type EntryEditType,
  entryCreateSchema,
  entryEditSchema,
} from "~/components/admin/entry-edit-form/schema";
import { isNonEmptyString } from "~/lib/validation";
import { requireAdminAction } from "~/server/auth/guard";
import { createLexicalEntry, deleteLexicalEntryById, updateLexicalEntry } from "~/server/db/repository/lexical-entry";
import type { LanguageType } from "~/server/db/schema";

const parseOrThrow = <S extends z.ZodType>(schema: S, data: unknown): z.output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`Invalid entry data — ${details.join("; ")}`);
  }
  return result.data;
};

interface RevalidateLexicalEntryPages {
  root?: string | null;
  normalizedText?: string | null;
  language?: LanguageType | null;
}

const revalidateLexicalEntryPages = (...entries: RevalidateLexicalEntryPages[]) => {
  entries.forEach((entry) => {
    if (isNonEmptyString(entry.normalizedText)) {
      revalidatePath(`/entry/${entry.normalizedText}`);
    }
    if (isNonEmptyString(entry.root)) {
      revalidatePath(`/root/${entry.root}`);
    }
    if (isNonEmptyString(entry.language)) {
      revalidatePath(`/lang/${entry.language}`);
    }
  });
};

export async function createLexicalEntryAction(data: EntryCreateType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryCreateSchema, data);
  revalidateLexicalEntryPages(entry);
  return createLexicalEntry(entry);
}

export async function updateLexicalEntryAction(data: EntryEditType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryEditSchema, data);

  const updated = await updateLexicalEntry({ ...entry, id: entry.id });
  if (!updated) {
    throw new Error(`Lexical entry with id '${entry.id}' no longer exists`);
  }

  revalidateLexicalEntryPages(entry, updated);
  return updated;
}

export async function deleteLexicalEntryAction(id: number) {
  await requireAdminAction();
  const deleted = await deleteLexicalEntryById(id);

  if (!deleted) {
    throw new Error(`Failed to delete lexical entry with id '${id}'`);
  }

  revalidateLexicalEntryPages(deleted);
  redirect("/");
}
