import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  })
  .optional();

export const morphologyOverridesSchema = z.object({
  masdar_override: optionalTrimmedString,
  dual_form: optionalTrimmedString,
  plural_form: optionalTrimmedString,
  elative_form: optionalTrimmedString,
  no_passive: z.boolean().default(false),
});

export type MorphologyOverrides = z.infer<typeof morphologyOverridesSchema>;

export const parseMorphologyOverrides = (value: unknown): MorphologyOverrides => {
  const result = morphologyOverridesSchema.safeParse(value ?? {});
  return result.success ? result.data : { no_passive: false };
};
