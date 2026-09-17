import { z } from "zod";
import { validateFormOneVowels } from "~/lib/validation/formOneVowels";
import { MOODS, type MorphPatternRules, morphPatternRulesSchema, STEM_KEY } from "~/lib/validation/morphPatternRules";
import { radicalKindEnum, shortVowelEnum } from "~/server/db/schema";

const NON_EMPTY_MOOD_KEYS = ["perfect", "imperative"] as const;

const ruleValueAsTemplates = (value: MorphPatternRules[keyof MorphPatternRules]): string[] => {
  if (value === undefined) {
    return [];
  }
  return typeof value === "string" ? [value] : Object.values(value);
};

const morphPatternShape = {
  formNumber: z.int({ error: "Form number is required" }).min(1).max(10, { error: "Forms I through X only" }),
  vocalicTemplate: z.string().trim().min(1, "Vocalic template is required"),
  description: z.string().trim(),
  rules: morphPatternRulesSchema,
  noAffix: z.boolean().default(false),
  isLexical: z.boolean().default(false),
  radical1Kind: z.enum(radicalKindEnum.enumValues),
  radical2Kind: z.enum(radicalKindEnum.enumValues),
  radical3Kind: z.enum(radicalKindEnum.enumValues),
  isGeminate: z.boolean().default(false),
  perfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
  imperfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
};

const morphPatternBaseSchema = z.object(morphPatternShape);
type MorphPatternBase = z.infer<typeof morphPatternBaseSchema>;

const validateMorphPatternData = (data: MorphPatternBase, ctx: z.RefinementCtx) => {
  validateFormOneVowels(data, ctx);

  if (data.noAffix) {
    for (const key of [...MOODS, STEM_KEY]) {
      const value = data.rules[key];
      if (value !== undefined && typeof value === "string") {
        ctx.addIssue({
          code: "custom",
          message: "A no-affix pattern must spell this mood out per person — a single template can't be affixed",
          path: ["rules", key],
        });
      }
    }
  } else {
    for (const key of NON_EMPTY_MOOD_KEYS) {
      const value = data.rules[key];
      if (typeof value !== "object" || value === undefined) {
        continue;
      }
      for (const [person, form] of Object.entries(value)) {
        if (form === "") {
          ctx.addIssue({
            code: "custom",
            message: "A per-person cell can't be empty — no suffix is appended after it",
            path: ["rules", key, person],
          });
        }
      }
    }
  }

  if (!data.isLexical) {
    const hamzaSlots = [
      { slot: 1, kind: data.radical1Kind },
      { slot: 2, kind: data.radical2Kind },
      { slot: 3, kind: data.radical3Kind },
    ].filter(({ kind }) => kind === "hamza");

    if (hamzaSlots.length > 0) {
      const allTemplates = [
        ...ruleValueAsTemplates(data.rules.masdar),
        ...ruleValueAsTemplates(data.rules.active_participle),
        ...ruleValueAsTemplates(data.rules.passive_participle),
        ...ruleValueAsTemplates(data.rules.imperfect_stem),
        ...MOODS.flatMap((mood) => ruleValueAsTemplates(data.rules[mood])),
      ];
      for (const { slot } of hamzaSlots) {
        const placeholder = `{${slot}}`;
        if (allTemplates.length > 0 && allTemplates.some((template) => !template.includes(placeholder))) {
          ctx.addIssue({
            code: "custom",
            message: `Radical ${slot} is a hamza and this pattern is reached by root shape, so every rule must spell it out as ${placeholder} — a named-verb-only elision belongs behind "is_lexical"`,
            path: ["rules"],
          });
          break;
        }
      }
    }
  }
};

const morphPatternIdSchema = z.int({ error: "ID must be provided" }).positive({ error: "ID must be positive" });

export const morphPatternCreateSchema = morphPatternBaseSchema.superRefine(validateMorphPatternData);
export const morphPatternEditSchema = morphPatternBaseSchema
  .extend({ id: morphPatternIdSchema })
  .superRefine(validateMorphPatternData);
export const morphPatternFormSchema = morphPatternBaseSchema
  .extend({ id: morphPatternIdSchema.optional() })
  .superRefine(validateMorphPatternData);

export type MorphPatternCreateType = z.output<typeof morphPatternCreateSchema>;
export type MorphPatternEditType = z.output<typeof morphPatternEditSchema>;
export type MorphPatternFormInput = z.input<typeof morphPatternFormSchema>;
export type MorphPatternFormValues = z.output<typeof morphPatternFormSchema>;
