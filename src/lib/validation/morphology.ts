import { z } from "zod";

export const MAX_OVERRIDE_LENGTH = 100;

export const OVERRIDE_TEXT_KEYS = [
  "masdar_override",
  "active_participle_override",
  "passive_participle_override",
  "dual_form",
  "plural_form",
  "elative_form",
] as const;

export type OverrideTextKey = (typeof OVERRIDE_TEXT_KEYS)[number];

const ARABIC_SCRIPT_TEXT = /^[\p{Script_Extensions=Arabic}\s]+$/u;

export const isArabicScriptText = (value: string): boolean => ARABIC_SCRIPT_TEXT.test(value);

export const normalizeOverrideText = (value: string): string => value.normalize("NFC").trim();

const optionalOverrideText = z
  .string()
  .transform(normalizeOverrideText)
  .pipe(z.string().max(MAX_OVERRIDE_LENGTH, `An override can have at most ${MAX_OVERRIDE_LENGTH} characters`))
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const morphologyOverridesSchema = z.object({
  masdar_override: optionalOverrideText,
  active_participle_override: optionalOverrideText,
  passive_participle_override: optionalOverrideText,
  dual_form: optionalOverrideText,
  plural_form: optionalOverrideText,
  elative_form: optionalOverrideText,
  no_passive: z.boolean().default(false),
});

export type MorphologyOverrides = z.infer<typeof morphologyOverridesSchema>;

const storedOverrideText = z
  .string()
  .transform((value) => (value.trim() === "" ? undefined : value))
  .optional()
  .catch(undefined);

const storedOverridesSchema = z.object({
  masdar_override: storedOverrideText,
  active_participle_override: storedOverrideText,
  passive_participle_override: storedOverrideText,
  dual_form: storedOverrideText,
  plural_form: storedOverrideText,
  elative_form: storedOverrideText,
  no_passive: z.boolean().catch(false),
});

export const parseMorphologyOverrides = (value: unknown): MorphologyOverrides => {
  const result = storedOverridesSchema.safeParse(typeof value === "object" && value !== null ? value : {});
  return result.success ? result.data : { no_passive: false };
};
