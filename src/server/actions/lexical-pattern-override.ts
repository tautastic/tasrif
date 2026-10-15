"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  type OverrideCreateType,
  type OverrideEditType,
  overrideCreateSchema,
  overrideEditSchema,
} from "~/components/admin/lexical-pattern-override-form/schema";
import { idSchema } from "~/lib/validation/ids";
import { type ActionResult, fail, succeed } from "~/server/actions/result";
import { mapOverrideSaveError, UNIQUE_OVERRIDE_CONSTRAINT } from "~/server/actions/save-errors";
import { parseInput, revalidatePublicPages } from "~/server/actions/shared";
import { requireAdminAction } from "~/server/auth/guard";
import { isUniqueViolation } from "~/server/db/pg-error";
import { createOverride, deleteOverrideById, updateOverride } from "~/server/db/repository/lexical-pattern-override";
import { getMorphPatternById } from "~/server/db/repository/morph-pattern";

const mapSaveError = (error: unknown, variant: string | null): ActionResult<never> =>
  variant !== null && isUniqueViolation(error, UNIQUE_OVERRIDE_CONSTRAINT)
    ? fail("An override for this root, form number, vowels and variant already exists")
    : mapOverrideSaveError(error);

const checkVariantPattern = async (
  patternId: number,
  override: { variant: string | null; formNumber: number; perfectVowel: string | null; imperfectVowel: string | null },
): Promise<ActionResult<never> | null> => {
  if (override.variant === null) {
    return null;
  }
  const pattern = await getMorphPatternById(patternId);
  if (!pattern) {
    return fail("The morphological pattern no longer exists");
  }
  if (!pattern.isLexical) {
    return fail("A variant has to point to a lexical pattern, one that describes a single verb");
  }
  if (
    pattern.formNumber !== override.formNumber ||
    pattern.perfectVowel !== override.perfectVowel ||
    pattern.imperfectVowel !== override.imperfectVowel
  ) {
    return fail("The form and vowels of a variant must be those of its pattern");
  }
  return null;
};

export async function createOverrideAction(
  morphPatternId: number,
  data: OverrideCreateType,
): Promise<ActionResult<{ id: number }>> {
  await requireAdminAction();
  const patternId = parseInput(idSchema, morphPatternId, "pattern id");
  if (!patternId.ok) {
    return patternId;
  }
  const parsed = parseInput(overrideCreateSchema, data, "override data");
  if (!parsed.ok) {
    return parsed;
  }

  const refused = await checkVariantPattern(patternId.data, parsed.data);
  if (refused) {
    return refused;
  }

  try {
    const created = await createOverride({ ...parsed.data, morphPatternId: patternId.data });
    revalidatePublicPages();
    return succeed(created);
  } catch (error) {
    return mapSaveError(error, parsed.data.variant);
  }
}

export async function updateOverrideAction(
  morphPatternId: number,
  data: OverrideEditType,
): Promise<ActionResult<{ id: number }>> {
  await requireAdminAction();
  const patternId = parseInput(idSchema, morphPatternId, "pattern id");
  if (!patternId.ok) {
    return patternId;
  }
  const parsed = parseInput(overrideEditSchema, data, "override data");
  if (!parsed.ok) {
    return parsed;
  }

  const refused = await checkVariantPattern(patternId.data, parsed.data);
  if (refused) {
    return refused;
  }

  try {
    const updated = await updateOverride({ ...parsed.data, morphPatternId: patternId.data });
    if (!updated) {
      return fail(`Override with id '${parsed.data.id}' no longer exists`);
    }
    revalidatePublicPages();
    return succeed(updated);
  } catch (error) {
    return mapSaveError(error, parsed.data.variant);
  }
}

export async function deleteOverrideAction(morphPatternId: number, id: number): Promise<ActionResult> {
  await requireAdminAction();
  const ids = parseInput(z.tuple([idSchema, idSchema]), [morphPatternId, id], "override ids");
  if (!ids.ok) {
    return ids;
  }
  const deleted = await deleteOverrideById(id, morphPatternId);
  if (!deleted) {
    return fail(`Failed to delete override with id '${id}'`);
  }
  revalidatePublicPages();
  redirect(`/admin/morph-patterns/${morphPatternId}`);
}
