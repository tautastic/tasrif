import { z } from "zod";
import { validateFormOneVowels } from "~/lib/validation/formOneVowels";
import { triliteralRootSchema } from "~/lib/validation/root";
import { shortVowelEnum } from "~/server/db/schema";

const optionalTrimmedString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  })
  .optional();

export const MAX_VARIANT_LENGTH = 40;

export const VARIANT_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const VARIANT_MESSAGE =
  "A variant is a short lower-case name of letters, digits and single hyphens, starting with a letter";

const optionalVariant = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? "")
  .pipe(
    z
      .string()
      .max(MAX_VARIANT_LENGTH, `A variant can have at most ${MAX_VARIANT_LENGTH} characters`)
      .refine((value) => value === "" || VARIANT_PATTERN.test(value), { error: VARIANT_MESSAGE }),
  )
  .transform((value) => (value === "" ? null : value));

const overrideShape = {
  root: triliteralRootSchema,
  formNumber: z.int({ error: "Form number is required" }).min(1).max(10, { error: "Forms I through X only" }),
  perfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
  imperfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
  variant: optionalVariant,
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
