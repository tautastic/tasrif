import { z } from "zod";
import { affixMoodEnum, personTypeEnum } from "~/server/db/schema/affixRules";

export const PERSONS = personTypeEnum.enumValues;
export const MOODS = affixMoodEnum.enumValues;
export type Person = (typeof PERSONS)[number];
export type Mood = (typeof MOODS)[number];

export const IMPERATIVE_PERSONS = [
  "second_person_masculine_singular",
  "second_person_feminine_singular",
  "second_person_dual",
  "second_person_masculine_plural",
  "second_person_feminine_plural",
] as const satisfies readonly Person[];

export const STRING_KEYS = ["masdar", "active_participle", "passive_participle"] as const;
export const STEM_KEY = "imperfect_stem" as const;
export const IMPERFECT_MOOD_KEYS = [
  "imperfect_indicative",
  "imperfect_subjunctive",
  "imperfect_jussive",
] as const satisfies readonly Mood[];

export const PASSIVE_PERFECT_KEY = "passive_perfect" as const;
export const PASSIVE_STEM_KEY = "passive_imperfect_stem" as const;
export const PASSIVE_IMPERFECT_MOOD_KEYS = [
  "passive_imperfect_indicative",
  "passive_imperfect_subjunctive",
  "passive_imperfect_jussive",
] as const;
export const PASSIVE_KEYS = [PASSIVE_PERFECT_KEY, PASSIVE_STEM_KEY, ...PASSIVE_IMPERFECT_MOOD_KEYS] as const;
export type PassiveKey = (typeof PASSIVE_KEYS)[number];

export const MAX_TEMPLATE_LENGTH = 200;

const VALID_PLACEHOLDER_PATTERN = /\{[1234]\}/g;
const FOURTH_PLACEHOLDER = "{4}";
const BRACE_GROUP_PATTERN = /\{[^{}]*\}/;

export const findTemplateProblem = (template: string): string | null => {
  const withoutPlaceholders = template.replace(VALID_PLACEHOLDER_PATTERN, "");
  const malformed = BRACE_GROUP_PATTERN.exec(withoutPlaceholders);
  if (malformed) {
    return `Unknown placeholder "${malformed[0]}" — only {1}, {2}, {3} and {4} (typed as ف, ع, ل and ق in a pattern for four radicals) are allowed`;
  }
  if (/[{}]/.test(withoutPlaceholders)) {
    return "Unmatched brace in the template — placeholders are written {1}, {2}, {3} and {4} (typed as ف, ع, ل and ق)";
  }
  if (template.includes("\\")) {
    return "A backslash cannot be stored in a template — in the editor it only marks ف, ع or ل as ordinary letters";
  }
  return null;
};

const templateStringSchema = z
  .string()
  .max(MAX_TEMPLATE_LENGTH, `A template can have at most ${MAX_TEMPLATE_LENGTH} characters`)
  .superRefine((value, ctx) => {
    const problem = findTemplateProblem(value);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
    }
  });

const buildPersonObjectSchema = <P extends Person>(persons: readonly P[]) =>
  z.strictObject(
    Object.fromEntries(persons.map((person) => [person, templateStringSchema])) as Record<
      P,
      typeof templateStringSchema
    >,
  );

const allPersonsObjectSchema = buildPersonObjectSchema(PERSONS);
const imperativePersonsObjectSchema = buildPersonObjectSchema(IMPERATIVE_PERSONS);

const moodValueSchema = (mood: Mood) =>
  z.union([templateStringSchema, mood === "imperative" ? imperativePersonsObjectSchema : allPersonsObjectSchema]);

export const morphPatternRulesSchema = z
  .strictObject({
    masdar: templateStringSchema.optional(),
    active_participle: templateStringSchema.optional(),
    passive_participle: templateStringSchema.optional(),
    perfect: moodValueSchema("perfect").optional(),
    imperative: moodValueSchema("imperative").optional(),
    imperfect_indicative: moodValueSchema("imperfect_indicative").optional(),
    imperfect_subjunctive: moodValueSchema("imperfect_subjunctive").optional(),
    imperfect_jussive: moodValueSchema("imperfect_jussive").optional(),
    imperfect_stem: z.union([templateStringSchema, allPersonsObjectSchema]).optional(),
    passive_perfect: moodValueSchema("perfect").optional(),
    passive_imperfect_stem: z.union([templateStringSchema, allPersonsObjectSchema]).optional(),
    passive_imperfect_indicative: moodValueSchema("imperfect_indicative").optional(),
    passive_imperfect_subjunctive: moodValueSchema("imperfect_subjunctive").optional(),
    passive_imperfect_jussive: moodValueSchema("imperfect_jussive").optional(),
  })
  .superRefine((rules, ctx) => {
    const hasStem = rules.imperfect_stem !== undefined;
    const presentImperfectMoods = IMPERFECT_MOOD_KEYS.filter((mood) => rules[mood] !== undefined);
    const hasAnyMoodOrStem = hasStem || MOODS.some((mood) => rules[mood] !== undefined);

    if (!hasAnyMoodOrStem) {
      ctx.addIssue({
        code: "custom",
        message: "A pattern needs at least one mood (or imperfect_stem) to ever generate a paradigm",
        path: [],
      });
    }

    if (hasStem && presentImperfectMoods.length > 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "imperfect_stem cannot be combined with an explicit imperfect mood — the generator would silently prefer one based on key order",
        path: ["imperfect_stem"],
      });
    }

    const presentPassiveMoods = PASSIVE_IMPERFECT_MOOD_KEYS.filter((key) => rules[key] !== undefined);
    if (rules.passive_imperfect_stem !== undefined && presentPassiveMoods.length > 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "passive_imperfect_stem cannot be combined with an explicit passive imperfect mood — the generator would silently prefer one based on key order",
        path: ["passive_imperfect_stem"],
      });
    }
  });

export type MorphPatternRules = z.infer<typeof morphPatternRulesSchema>;

export const ruleTemplates = (rules: MorphPatternRules): { path: string[]; template: string }[] => {
  const found: { path: string[]; template: string }[] = [];
  for (const [key, value] of Object.entries(rules)) {
    if (typeof value === "string") {
      found.push({ path: [key], template: value });
    } else if (value !== undefined) {
      for (const [person, template] of Object.entries(value)) {
        found.push({ path: [key, person], template });
      }
    }
  }
  return found;
};

export const usesFourthRadical = (rules: MorphPatternRules): boolean =>
  ruleTemplates(rules).some(({ template }) => template.includes(FOURTH_PLACEHOLDER));

export const rulesRadicalCount = (rules: MorphPatternRules): 3 | 4 => (usesFourthRadical(rules) ? 4 : 3);
