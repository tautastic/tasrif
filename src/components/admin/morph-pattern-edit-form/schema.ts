import { z } from "zod";
import { validateFormOneVowels } from "~/lib/validation/formOneVowels";
import {
  MOODS,
  type MorphPatternRules,
  morphPatternRulesSchema,
  PASSIVE_KEYS,
  PASSIVE_PERFECT_KEY,
  ruleTemplates,
  STEM_KEY,
  usesFourthRadical,
} from "~/lib/validation/morphPatternRules";
import { radicalKindEnum, shortVowelEnum } from "~/server/db/schema";

const NON_EMPTY_MOOD_KEYS = ["perfect", "imperative", PASSIVE_PERFECT_KEY] as const;

const ruleValueAsTemplates = (value: MorphPatternRules[keyof MorphPatternRules]): string[] => {
  if (value === undefined) {
    return [];
  }
  return typeof value === "string" ? [value] : Object.values(value);
};

const morphPatternShape = {
  formNumber: z.int({ error: "Form number is required" }).min(1).max(10, { error: "Forms I through X only" }),
  radicalCount: z
    .int({ error: "Radical count is required" })
    .min(3, { error: "A verb root has 3 or 4 radicals" })
    .max(4, { error: "A verb root has 3 or 4 radicals" })
    .default(3),
  vocalicTemplate: z.string().trim().min(1, "Vocalic template is required"),
  description: z.string().trim(),
  rules: morphPatternRulesSchema,
  noAffix: z.boolean().default(false),
  isLexical: z.boolean().default(false),
  radical1Kind: z.enum(radicalKindEnum.enumValues),
  radical2Kind: z.enum(radicalKindEnum.enumValues),
  radical3Kind: z.enum(radicalKindEnum.enumValues),
  radical4Kind: z.enum(radicalKindEnum.enumValues).default("sound"),
  isGeminate: z.boolean().default(false),
  perfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
  imperfectVowel: z.enum(shortVowelEnum.enumValues).nullable(),
};

const morphPatternBaseSchema = z.object(morphPatternShape);
type MorphPatternBase = z.infer<typeof morphPatternBaseSchema>;

const MAX_QUADRILITERAL_FORM = 4;

const validateRadicalCount = (data: MorphPatternBase, ctx: z.RefinementCtx) => {
  const usesFourth = usesFourthRadical(data.rules);
  if (data.radicalCount === 3) {
    for (const { path, template } of ruleTemplates(data.rules)) {
      if (template.includes("{4}")) {
        ctx.addIssue({
          code: "custom",
          message:
            'Unknown placeholder "{4}" — a pattern for three radicals has {1}, {2} and {3} only; set the pattern to four radicals to use {4}',
          path: ["rules", ...path],
        });
      }
    }
    if (data.radical4Kind !== "sound") {
      ctx.addIssue({
        code: "custom",
        message: "A pattern for three radicals has no fourth radical: leave it Sound",
        path: ["radical4Kind"],
      });
    }
    return;
  }
  if (data.radical4Kind === "hamza") {
    ctx.addIssue({
      code: "custom",
      message: "A hamza as the last radical is written like a sound letter: choose Sound, Weak — و or Weak — ي",
      path: ["radical4Kind"],
    });
  }
  if (data.formNumber > MAX_QUADRILITERAL_FORM) {
    ctx.addIssue({
      code: "custom",
      message: "The quadriliteral verb has forms I to IV only",
      path: ["formNumber"],
    });
  }
  if (!usesFourth) {
    ctx.addIssue({
      code: "custom",
      message: "A pattern for four radicals must use the fourth radical ({4}, typed as ق) in at least one template",
      path: ["rules"],
    });
  }
  const shaped = [
    ["radical1Kind", data.radical1Kind],
    ["radical2Kind", data.radical2Kind],
    ["radical3Kind", data.radical3Kind],
  ] as const;
  for (const [name, kind] of shaped) {
    if (kind !== "sound") {
      ctx.addIssue({
        code: "custom",
        message: "A weak letter before the last radical of a quadriliteral verb is a consonant: leave it Sound",
        path: [name],
      });
    }
  }
  if (data.isGeminate) {
    ctx.addIssue({
      code: "custom",
      message: "A quadriliteral pattern is not geminate",
      path: ["isGeminate"],
    });
  }
};

const validateMorphPatternData = (data: MorphPatternBase, ctx: z.RefinementCtx) => {
  validateFormOneVowels(data, ctx);
  validateRadicalCount(data, ctx);

  if (data.noAffix) {
    for (const key of [...MOODS, STEM_KEY, ...PASSIVE_KEYS]) {
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
        ...PASSIVE_KEYS.flatMap((key) => ruleValueAsTemplates(data.rules[key])),
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
