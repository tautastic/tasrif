"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  type OverrideCreateType,
  type OverrideEditType,
  overrideCreateSchema,
  overrideEditSchema,
} from "~/components/admin/lexical-pattern-override-form/schema";
import { requireAdminAction } from "~/server/auth/guard";
import { createOverride, deleteOverrideById, updateOverride } from "~/server/db/repository/lexical-pattern-override";

const parseOrThrow = <S extends z.ZodType>(schema: S, data: unknown): z.output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`Invalid override data — ${details.join("; ")}`);
  }
  return result.data;
};

const UNIQUE_VIOLATION_SQLSTATE = "23505";

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return false;
  }
  const cause = (error as { cause: unknown }).cause;
  return (
    typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === UNIQUE_VIOLATION_SQLSTATE
  );
};

export async function createOverrideAction(morphPatternId: number, data: OverrideCreateType) {
  await requireAdminAction();
  const override = parseOrThrow(overrideCreateSchema, data);

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
  const override = parseOrThrow(overrideEditSchema, data);

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
