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
import { formatVerbFormChoiceLabel, type VerbFormChoice } from "~/lib/validation/verbFormChoice";
import { requireAdminAction } from "~/server/auth/guard";
import { createLexicalEntry, deleteLexicalEntryById, updateLexicalEntry } from "~/server/db/repository/lexical-entry";
import { resolveVerbMorphPattern } from "~/server/db/repository/morph-pattern";
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

const withResolvedMorphPattern = async <T extends { root: string | null; verbFormChoice: VerbFormChoice | null }>(
  entry: T,
): Promise<Omit<T, "verbFormChoice"> & { morphPatternId: number | null }> => {
  const { verbFormChoice, ...rest } = entry;
  if (!verbFormChoice) {
    return { ...rest, morphPatternId: null };
  }
  if (!rest.root) {
    throw new Error("Root is required to resolve a verb's morphological pattern");
  }

  let pattern: Awaited<ReturnType<typeof resolveVerbMorphPattern>>;
  try {
    pattern = await resolveVerbMorphPattern(rest.root, verbFormChoice);
  } catch {
    throw new Error(`Root '${rest.root}' is not a valid triliteral root`);
  }

  if (!pattern) {
    throw new Error(
      `No morphological pattern is available yet for root '${rest.root}' in ${formatVerbFormChoiceLabel(verbFormChoice)}`,
    );
  }

  return { ...rest, morphPatternId: pattern.id };
};

export async function createLexicalEntryAction(data: EntryCreateType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryCreateSchema, data);
  const resolved = await withResolvedMorphPattern(entry);
  revalidateLexicalEntryPages(resolved);
  return createLexicalEntry(resolved);
}

export async function updateLexicalEntryAction(data: EntryEditType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryEditSchema, data);
  const resolved = await withResolvedMorphPattern(entry);

  const updated = await updateLexicalEntry(resolved);
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
