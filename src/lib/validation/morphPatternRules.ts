import { z } from "zod";
import { affixMoodEnum, personTypeEnum } from "~/server/db/schema/affixRules";

// Canonical source: the shapes generate_conjugation_rows / generate_verbal_nouns (db/0002_generate_stems.sql)
// actually read, and what tests/invariants/pattern-data.test.ts enforces against the database. Keep both in sync.

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

const PLACEHOLDER_PATTERN = /\{[^123]\}|\{\d{2,}\}/;

const templateStringSchema = z.string().refine((value) => !PLACEHOLDER_PATTERN.test(value), {
  message: "Only the {1}, {2}, {3} radical placeholders are allowed",
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
  });

export type MorphPatternRules = z.infer<typeof morphPatternRulesSchema>;
