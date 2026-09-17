"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type OverrideCreateType,
  type OverrideEditType,
  overrideCreateSchema,
  overrideEditSchema,
} from "~/components/admin/lexical-pattern-override-form/schema";
import { parseOrThrow } from "~/server/actions/shared";
import { requireAdminAction } from "~/server/auth/guard";
import { isUniqueViolation } from "~/server/db/pg-error";
import { createOverride, deleteOverrideById, updateOverride } from "~/server/db/repository/lexical-pattern-override";

export async function createOverrideAction(morphPatternId: number, data: OverrideCreateType) {
  await requireAdminAction();
  const override = parseOrThrow(overrideCreateSchema, data, "override data");

  try {
    const created = await createOverride({ ...override, morphPatternId });
    revalidatePath(`/admin/morph-patterns/${morphPatternId}`);
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("An override for this root, form number, and vowels already exists");
    }
    throw error;
  }
}

export async function updateOverrideAction(morphPatternId: number, data: OverrideEditType) {
  await requireAdminAction();
  const override = parseOrThrow(overrideEditSchema, data, "override data");

  try {
    const updated = await updateOverride({ ...override, morphPatternId });
    if (!updated) {
      throw new Error(`Override with id '${override.id}' no longer exists`);
    }
    revalidatePath(`/admin/morph-patterns/${morphPatternId}`);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("An override for this root, form number, and vowels already exists");
    }
    throw error;
  }
}

export async function deleteOverrideAction(morphPatternId: number, id: number) {
  await requireAdminAction();
  const deleted = await deleteOverrideById(id);
  if (!deleted) {
    throw new Error(`Failed to delete override with id '${id}'`);
  }
  revalidatePath(`/admin/morph-patterns/${morphPatternId}`);
  redirect(`/admin/morph-patterns/${morphPatternId}`);
}
