"use server";

import { redirect } from "next/navigation";
import {
  type MorphPatternCreateType,
  type MorphPatternEditType,
  morphPatternCreateSchema,
  morphPatternEditSchema,
} from "~/components/admin/morph-pattern-edit-form/schema";
import { idListSchema, idSchema } from "~/lib/validation/ids";
import { morphPatternPreviewInputSchema } from "~/lib/validation/morphPatternPreview";
import type { MorphPatternRules } from "~/lib/validation/morphPatternRules";
import { type ActionResult, fail, succeed } from "~/server/actions/result";
import { mapPatternSaveError } from "~/server/actions/save-errors";
import { parseInput, revalidatePublicPages } from "~/server/actions/shared";
import { requireAdminAction } from "~/server/auth/guard";
import { getPgErrorWithCode } from "~/server/db/pg-error";
import {
  createMorphPattern,
  deleteMorphPatternById,
  findAmbiguousPattern,
  getMorphPatternUsageCounts,
  INVALID_ROOT_SQLSTATE,
  type PreviewParadigmCell,
  type PreviewVerbalNouns,
  previewConjugation,
  previewPassiveConjugation,
  previewVerbalNouns,
  updateMorphPattern,
} from "~/server/db/repository/morph-pattern";

const describeAmbiguity = async (pattern: MorphPatternCreateType | MorphPatternEditType, excludeId?: number) => {
  if (pattern.isLexical) {
    return null;
  }
  const collision = await findAmbiguousPattern(
    {
      formNumber: pattern.formNumber,
      radicalCount: pattern.radicalCount,
      radical1Kind: pattern.radical1Kind,
      radical2Kind: pattern.radical2Kind,
      radical3Kind: pattern.radical3Kind,
      radical4Kind: pattern.radical4Kind,
      isGeminate: pattern.isGeminate,
      perfectVowel: pattern.perfectVowel,
      imperfectVowel: pattern.imperfectVowel,
    },
    excludeId,
  );
  if (!collision) {
    return null;
  }
  return `Pattern #${collision.id} ("${collision.description || "untitled"}") already matches this exact root shape and vowel combination — resolve_morph_pattern_id would pick one of them arbitrarily`;
};

export async function createMorphPatternAction(data: MorphPatternCreateType): Promise<ActionResult<{ id: number }>> {
  await requireAdminAction();
  const parsed = parseInput(morphPatternCreateSchema, data, "pattern data");
  if (!parsed.ok) {
    return parsed;
  }
  const ambiguity = await describeAmbiguity(parsed.data);
  if (ambiguity) {
    return fail(ambiguity);
  }

  try {
    const created = await createMorphPattern(parsed.data);
    revalidatePublicPages();
    return succeed(created);
  } catch (error) {
    return mapPatternSaveError(error, parsed.data);
  }
}

export async function updateMorphPatternAction(data: MorphPatternEditType): Promise<ActionResult<{ id: number }>> {
  await requireAdminAction();
  const parsed = parseInput(morphPatternEditSchema, data, "pattern data");
  if (!parsed.ok) {
    return parsed;
  }
  const ambiguity = await describeAmbiguity(parsed.data, parsed.data.id);
  if (ambiguity) {
    return fail(ambiguity);
  }

  try {
    const updated = await updateMorphPattern(parsed.data);
    if (!updated) {
      return fail(`Morphological pattern with id '${parsed.data.id}' no longer exists`);
    }
    revalidatePublicPages();
    return succeed(updated);
  } catch (error) {
    return mapPatternSaveError(error, parsed.data);
  }
}

export async function deleteMorphPatternAction(id: number): Promise<ActionResult> {
  await requireAdminAction();
  const parsedId = parseInput(idSchema, id, "pattern id");
  if (!parsedId.ok) {
    return parsedId;
  }
  const { entryCount, overrideCount } = await getMorphPatternUsageCounts(parsedId.data);
  if (entryCount > 0 || overrideCount > 0) {
    return fail(
      `Cannot delete: still referenced by ${entryCount} ${entryCount === 1 ? "entry" : "entries"} and ${overrideCount} ${overrideCount === 1 ? "override" : "overrides"}`,
    );
  }

  const deleted = await deleteMorphPatternById(id);
  if (!deleted) {
    return fail(`Failed to delete morphological pattern with id '${id}'`);
  }
  revalidatePublicPages();
  redirect("/admin/morph-patterns");
}

export async function deleteMorphPatternsAction(ids: number[]): Promise<ActionResult> {
  await requireAdminAction();
  const parsedIds = parseInput(idListSchema, ids, "pattern ids");
  if (!parsedIds.ok) {
    return parsedIds;
  }

  const usages = await Promise.all(
    parsedIds.data.map(async (id) => ({ id, usage: await getMorphPatternUsageCounts(id) })),
  );
  const inUse = usages.filter(({ usage }) => usage.entryCount > 0 || usage.overrideCount > 0);
  if (inUse.length > 0) {
    return fail(
      `Cannot delete: pattern(s) ${inUse.map(({ id }) => id).join(", ")} still referenced by entries or overrides`,
    );
  }

  const deleted = await Promise.all(parsedIds.data.map((id) => deleteMorphPatternById(id)));
  const successCount = deleted.filter((pattern) => pattern !== null).length;

  if (successCount > 0) {
    revalidatePublicPages();
  }

  const failedCount = parsedIds.data.length - successCount;
  if (failedCount > 0) {
    return fail(`Failed to delete ${failedCount} ${failedCount === 1 ? "pattern" : "patterns"}`);
  }
  return succeed(undefined);
}

export interface PreviewMorphPatternInput {
  root: string;
  rules: MorphPatternRules;
  formNumber: number;
  noAffix: boolean;
}

export interface PreviewMorphPatternResult {
  conjugation: PreviewParadigmCell[];
  passive: PreviewParadigmCell[];
  verbalNouns: PreviewVerbalNouns;
}

export async function previewMorphPatternAction(
  input: PreviewMorphPatternInput,
): Promise<ActionResult<PreviewMorphPatternResult>> {
  await requireAdminAction();
  const parsed = parseInput(morphPatternPreviewInputSchema, input, "preview input");
  if (!parsed.ok) {
    return parsed;
  }

  try {
    const [conjugation, passive, verbalNouns] = await Promise.all([
      previewConjugation(parsed.data),
      previewPassiveConjugation(parsed.data),
      previewVerbalNouns(parsed.data),
    ]);
    return succeed({ conjugation, passive, verbalNouns });
  } catch (error) {
    const invalidRoot = getPgErrorWithCode(error, INVALID_ROOT_SQLSTATE);
    if (!invalidRoot) {
      throw error;
    }
    return fail(invalidRoot.message);
  }
}
