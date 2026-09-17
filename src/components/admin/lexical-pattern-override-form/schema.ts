import { z } from "zod";
import { validateFormOneVowels } from "~/lib/validation/formOneVowels";
import { shortVowelEnum } from "~/server/db/schema";

const optionalTrimmedString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  })
  .optional();

const overrideShape = {
  root: z.string().trim().min(1, "Root is required"),
  formNumber: z.int({ error: "Form number is required" }).min(1).max(10, { error: "Forms I through X only" }),
  perfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
  imperfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
  note: optionalTrimmedString,
};

const overrideBaseSchema = z.object(overrideShape);

const overrideIdSchema = z.int({ error: "ID must be provided" }).positive({ error: "ID must be positive" });

export const overrideCreateSchema = overrideBaseSchema.superRefine(validateFormOneVowels);
export const overrideEditSchema = overrideBaseSchema
  .extend({ id: overrideIdSchema })
  .superRefine(validateFormOneVowels);
export const overrideFormSchema = overrideBaseSchema
  .extend({ id: overrideIdSchema.optional() })
  .superRefine(validateFormOneVowels);

export type OverrideCreateType = z.output<typeof overrideCreateSchema>;
export type OverrideEditType = z.output<typeof overrideEditSchema>;
export type OverrideFormInput = z.input<typeof overrideFormSchema>;
export type OverrideFormValues = z.output<typeof overrideFormSchema>;
