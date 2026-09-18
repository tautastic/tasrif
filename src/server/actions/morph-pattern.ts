"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type MorphPatternCreateType,
  type MorphPatternEditType,
  morphPatternCreateSchema,
  morphPatternEditSchema,
} from "~/components/admin/morph-pattern-edit-form/schema";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import type { MorphPatternRules } from "~/lib/validation/morphPatternRules";
import { parseOrThrow } from "~/server/actions/shared";
import { requireAdminAction } from "~/server/auth/guard";
import { isUniqueViolation } from "~/server/db/pg-error";
import {
  createMorphPattern,
  deleteMorphPatternById,
  findAmbiguousPattern,
  getMorphPatternUsageCounts,
  previewConjugation,
  previewVerbalNouns,
  updateMorphPattern,
} from "~/server/db/repository/morph-pattern";

const assertNotAmbiguous = async (pattern: MorphPatternCreateType | MorphPatternEditType, excludeId?: number) => {
  if (pattern.isLexical) {
    return;
  }
  const collision = await findAmbiguousPattern(
    {
      formNumber: pattern.formNumber,
      radical1Kind: pattern.radical1Kind,
      radical2Kind: pattern.radical2Kind,
      radical3Kind: pattern.radical3Kind,
      isGeminate: pattern.isGeminate,
      perfectVowel: pattern.perfectVowel,
      imperfectVowel: pattern.imperfectVowel,
    },
    excludeId,
  );
  if (collision) {
    throw new Error(
      `Pattern #${collision.id} ("${collision.description || "untitled"}") already matches this exact root shape and vowel combination — resolve_morph_pattern_id would pick one of them arbitrarily`,
    );
  }
};

export async function createMorphPatternAction(data: MorphPatternCreateType) {
  await requireAdminAction();
  const pattern = parseOrThrow(morphPatternCreateSchema, data, "pattern data");
  await assertNotAmbiguous(pattern);

  try {
    const created = await createMorphPattern(pattern);
    revalidatePath("/admin/morph-patterns");
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        `A form ${formatMorphPatternFormNumber(pattern.formNumber)} pattern with description "${pattern.description}" already exists`,
      );
    }
    throw error;
  }
}

export async function updateMorphPatternAction(data: MorphPatternEditType) {
  await requireAdminAction();
  const pattern = parseOrThrow(morphPatternEditSchema, data, "pattern data");
  await assertNotAmbiguous(pattern, pattern.id);

  try {
    const updated = await updateMorphPattern(pattern);
    if (!updated) {
      throw new Error(`Morphological pattern with id '${pattern.id}' no longer exists`);
    }
    revalidatePath("/admin/morph-patterns");
    revalidatePath(`/admin/morph-patterns/${pattern.id}`);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        `A form ${formatMorphPatternFormNumber(pattern.formNumber)} pattern with description "${pattern.description}" already exists`,
      );
    }
    throw error;
  }
}

export async function deleteMorphPatternAction(id: number) {
  await requireAdminAction();
  const { entryCount, overrideCount } = await getMorphPatternUsageCounts(id);
  if (entryCount > 0 || overrideCount > 0) {
    throw new Error(
      `Cannot delete: still referenced by ${entryCount} ${entryCount === 1 ? "entry" : "entries"} and ${overrideCount} ${overrideCount === 1 ? "override" : "overrides"}`,
    );
  }

  const deleted = await deleteMorphPatternById(id);
  if (!deleted) {
    throw new Error(`Failed to delete morphological pattern with id '${id}'`);
  }
  revalidatePath("/admin/morph-patterns");
  redirect("/admin/morph-patterns");
}

export async function deleteMorphPatternsAction(ids: number[]) {
  await requireAdminAction();

  const usages = await Promise.all(ids.map(async (id) => ({ id, usage: await getMorphPatternUsageCounts(id) })));
  const inUse = usages.filter(({ usage }) => usage.entryCount > 0 || usage.overrideCount > 0);
  if (inUse.length > 0) {
    throw new Error(
      `Cannot delete: pattern(s) ${inUse.map(({ id }) => id).join(", ")} still referenced by entries or overrides`,
    );
  }

  const deleted = await Promise.all(ids.map((id) => deleteMorphPatternById(id)));
  const successful = deleted.filter((pattern): pattern is NonNullable<typeof pattern> => pattern !== null);
  if (successful.length < ids.length) {
    const failedCount = ids.length - successful.length;
    throw new Error(`Failed to delete ${failedCount} ${failedCount === 1 ? "pattern" : "patterns"}`);
  }

  revalidatePath("/admin/morph-patterns");
}

export interface PreviewMorphPatternInput {
  root: string;
  rules: MorphPatternRules;
  formNumber: number;
  noAffix: boolean;
}

export async function previewMorphPatternAction(input: PreviewMorphPatternInput) {
  await requireAdminAction();
  const [conjugation, verbalNouns] = await Promise.all([previewConjugation(input), previewVerbalNouns(input)]);
  return { conjugation, verbalNouns };
}
