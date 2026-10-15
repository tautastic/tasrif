"use server";

import { redirect } from "next/navigation";
import {
  type EntryCreateType,
  type EntryEditType,
  entryCreateSchema,
  entryEditSchema,
} from "~/components/admin/entry-edit-form/schema";
import { idListSchema, idSchema } from "~/lib/validation/ids";
import {
  formatVerbFormChoiceLabel,
  type VerbFormChoice,
  verbFormChoiceRadicalCount,
} from "~/lib/validation/verbFormChoice";
import { type ActionResult, fail, succeed } from "~/server/actions/result";
import { invalidRootMessage, mapEntrySaveError } from "~/server/actions/save-errors";
import { parseInput, revalidateEntryPaths, revalidatePublicPages } from "~/server/actions/shared";
import { requireAdminAction } from "~/server/auth/guard";
import { getPgErrorWithCode } from "~/server/db/pg-error";
import { createLexicalEntry, deleteLexicalEntryById, updateLexicalEntry } from "~/server/db/repository/lexical-entry";
import {
  getEntryMorphPatternId,
  INVALID_ROOT_SQLSTATE,
  isMorphPatternChoiceAllowed,
  resolveVerbMorphPattern,
} from "~/server/db/repository/morph-pattern";

interface SavedEntry {
  id: number;
  slug: string;
  isVerified: boolean;
}

interface ResolvableEntry {
  root: string | null;
  verbFormChoice: VerbFormChoice | null;
  chosenMorphPatternId?: number | null | undefined;
}

type ResolvedEntry<T extends ResolvableEntry> = Omit<T, "verbFormChoice" | "chosenMorphPatternId"> & {
  morphPatternId: number | null;
};

const noPatternMessage = (root: string, verbFormChoice: VerbFormChoice) =>
  `No morphological pattern is available yet for root '${root}' in ${formatVerbFormChoiceLabel(verbFormChoice)}`;

const chooseMorphPatternId = async (
  root: string,
  verbFormChoice: VerbFormChoice,
  chosenId: number | null,
  storedId: number | null,
): Promise<ActionResult<number>> => {
  if (chosenId !== null) {
    return (await isMorphPatternChoiceAllowed(root, verbFormChoice, chosenId))
      ? succeed(chosenId)
      : fail(`The chosen pattern is not available for root '${root}' in ${formatVerbFormChoiceLabel(verbFormChoice)}`);
  }

  const pattern = await resolveVerbMorphPattern(root, verbFormChoice);
  if (
    storedId !== null &&
    storedId !== pattern?.id &&
    (await isMorphPatternChoiceAllowed(root, verbFormChoice, storedId))
  ) {
    return succeed(storedId);
  }
  return pattern ? succeed(pattern.id) : fail(noPatternMessage(root, verbFormChoice));
};

const withResolvedMorphPattern = async <T extends ResolvableEntry>(
  entry: T,
  entryId: number | null = null,
): Promise<ActionResult<ResolvedEntry<T>>> => {
  const { verbFormChoice, chosenMorphPatternId, ...rest } = entry;
  if (!verbFormChoice) {
    return succeed({ ...rest, morphPatternId: null });
  }
  if (!rest.root) {
    return fail("Root is required to resolve a verb's morphological pattern");
  }

  let chosen: ActionResult<number>;
  try {
    const storedId = entryId === null ? null : await getEntryMorphPatternId(entryId);
    chosen = await chooseMorphPatternId(rest.root, verbFormChoice, chosenMorphPatternId ?? null, storedId);
  } catch (error) {
    if (!getPgErrorWithCode(error, INVALID_ROOT_SQLSTATE)) {
      throw error;
    }
    return fail(invalidRootMessage(rest.root, verbFormChoiceRadicalCount(verbFormChoice)));
  }

  return chosen.ok ? succeed({ ...rest, morphPatternId: chosen.data }) : chosen;
};

export async function createLexicalEntryAction(data: EntryCreateType): Promise<ActionResult<SavedEntry>> {
  await requireAdminAction();
  const parsed = parseInput(entryCreateSchema, data, "entry data");
  if (!parsed.ok) {
    return parsed;
  }
  const resolved = await withResolvedMorphPattern(parsed.data);
  if (!resolved.ok) {
    return resolved;
  }

  try {
    const created = await createLexicalEntry(resolved.data);
    revalidatePublicPages();
    revalidateEntryPaths([created.slug]);
    return succeed(created);
  } catch (error) {
    return mapEntrySaveError(
      error,
      resolved.data.root,
      parsed.data.verbFormChoice ? verbFormChoiceRadicalCount(parsed.data.verbFormChoice) : 3,
    );
  }
}

export async function updateLexicalEntryAction(data: EntryEditType): Promise<ActionResult<SavedEntry>> {
  await requireAdminAction();
  const parsed = parseInput(entryEditSchema, data, "entry data");
  if (!parsed.ok) {
    return parsed;
  }
  const resolved = await withResolvedMorphPattern(parsed.data, parsed.data.id);
  if (!resolved.ok) {
    return resolved;
  }

  try {
    const updated = await updateLexicalEntry(resolved.data);
    if (!updated) {
      return fail(`Lexical entry with id '${parsed.data.id}' no longer exists`);
    }

    const { previousSlug, ...saved } = updated;
    revalidatePublicPages();
    revalidateEntryPaths([previousSlug, saved.slug]);
    return succeed(saved);
  } catch (error) {
    return mapEntrySaveError(
      error,
      resolved.data.root,
      parsed.data.verbFormChoice ? verbFormChoiceRadicalCount(parsed.data.verbFormChoice) : 3,
    );
  }
}

export async function deleteLexicalEntryAction(id: number): Promise<ActionResult> {
  await requireAdminAction();
  const parsedId = parseInput(idSchema, id, "entry id");
  if (!parsedId.ok) {
    return parsedId;
  }
  const deleted = await deleteLexicalEntryById(parsedId.data);
  if (!deleted) {
    return fail(`Failed to delete lexical entry with id '${id}'`);
  }

  revalidatePublicPages();
  revalidateEntryPaths([deleted.slug]);
  redirect("/");
}

export async function deleteLexicalEntriesAction(ids: number[]): Promise<ActionResult> {
  await requireAdminAction();
  const parsedIds = parseInput(idListSchema, ids, "entry ids");
  if (!parsedIds.ok) {
    return parsedIds;
  }

  const deleted = await Promise.all(parsedIds.data.map((id) => deleteLexicalEntryById(id)));
  const removed = deleted.filter((entry) => entry !== undefined);
  const successCount = removed.length;

  if (successCount > 0) {
    revalidatePublicPages();
    revalidateEntryPaths(removed.map((entry) => entry.slug));
  }

  const failedCount = parsedIds.data.length - successCount;
  if (failedCount > 0) {
    return fail(`Failed to delete ${failedCount} lexical ${failedCount === 1 ? "entry" : "entries"}`);
  }
  return succeed(undefined);
}
