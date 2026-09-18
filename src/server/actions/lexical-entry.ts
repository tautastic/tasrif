"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type EntryCreateType,
  type EntryEditType,
  entryCreateSchema,
  entryEditSchema,
} from "~/components/admin/entry-edit-form/schema";
import { isNonEmptyString } from "~/lib/validation";
import { formatVerbFormChoiceLabel, type VerbFormChoice } from "~/lib/validation/verbFormChoice";
import { parseOrThrow } from "~/server/actions/shared";
import { requireAdminAction } from "~/server/auth/guard";
import { getPgErrorWithCode, isUniqueViolation } from "~/server/db/pg-error";
import { createLexicalEntry, deleteLexicalEntryById, updateLexicalEntry } from "~/server/db/repository/lexical-entry";
import { INVALID_ROOT_SQLSTATE, resolveVerbMorphPattern } from "~/server/db/repository/morph-pattern";
import type { LanguageType } from "~/server/db/schema";

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
  } catch (error) {
    if (!getPgErrorWithCode(error, INVALID_ROOT_SQLSTATE)) {
      throw error;
    }
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
  const entry = parseOrThrow(entryCreateSchema, data, "entry data");
  const resolved = await withResolvedMorphPattern(entry);

  try {
    const created = await createLexicalEntry(resolved);
    revalidateLexicalEntryPages(resolved, created);
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("An entry with this language and text already exists");
    }
    throw error;
  }
}

export async function updateLexicalEntryAction(data: EntryEditType) {
  await requireAdminAction();
  const entry = parseOrThrow(entryEditSchema, data, "entry data");
  const resolved = await withResolvedMorphPattern(entry);

  try {
    const updated = await updateLexicalEntry(resolved);
    if (!updated) {
      throw new Error(`Lexical entry with id '${entry.id}' no longer exists`);
    }

    revalidateLexicalEntryPages(entry, updated);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("An entry with this language and text already exists");
    }
    throw error;
  }
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

export async function deleteLexicalEntriesAction(ids: number[]) {
  await requireAdminAction();

  const deleted = await Promise.all(ids.map((id) => deleteLexicalEntryById(id)));
  const successful = deleted.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  if (successful.length < ids.length) {
    const failedCount = ids.length - successful.length;
    throw new Error(`Failed to delete ${failedCount} lexical ${failedCount === 1 ? "entry" : "entries"}`);
  }

  revalidateLexicalEntryPages(...successful);
  revalidatePath("/admin/entries");
}
