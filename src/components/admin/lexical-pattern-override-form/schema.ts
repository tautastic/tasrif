import { z } from "zod";
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
type OverrideBase = z.infer<typeof overrideBaseSchema>;

const validateOverrideData = (data: OverrideBase, ctx: z.RefinementCtx) => {
  const hasBothVowels = data.perfectVowel !== null && data.imperfectVowel !== null;
  const hasEitherVowel = data.perfectVowel !== null || data.imperfectVowel !== null;
  if (data.formNumber === 1 && !hasBothVowels) {
    ctx.addIssue({
      code: "custom",
      message: "Form I needs both a perfect and an imperfect vowel",
      path: ["perfectVowel"],
    });
  }
  if (data.formNumber !== 1 && hasEitherVowel) {
    ctx.addIssue({ code: "custom", message: "Perfect/imperfect vowels only apply to form I", path: ["perfectVowel"] });
  }
};

const overrideIdSchema = z.int({ error: "ID must be provided" }).positive({ error: "ID must be positive" });

export const overrideCreateSchema = overrideBaseSchema.superRefine(validateOverrideData);
export const overrideEditSchema = overrideBaseSchema.extend({ id: overrideIdSchema }).superRefine(validateOverrideData);
export const overrideFormSchema = overrideBaseSchema
  .extend({ id: overrideIdSchema.optional() })
  .superRefine(validateOverrideData);

export type OverrideCreateType = z.output<typeof overrideCreateSchema>;
export type OverrideEditType = z.output<typeof overrideEditSchema>;
export type OverrideFormInput = z.input<typeof overrideFormSchema>;
export type OverrideFormValues = z.output<typeof overrideFormSchema>;
