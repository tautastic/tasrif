import assert from "node:assert/strict";
import { test } from "node:test";
import { morphPatternCreateSchema } from "../../src/components/admin/morph-pattern-edit-form/schema.ts";

const FULL_PERSON_TEMPLATE = {
  first_person_singular: "x",
  second_person_masculine_singular: "x",
  second_person_feminine_singular: "x",
  third_person_masculine_singular: "x",
  third_person_feminine_singular: "x",
  second_person_dual: "x",
  third_person_masculine_dual: "x",
  third_person_feminine_dual: "x",
  first_person_plural: "x",
  second_person_masculine_plural: "x",
  second_person_feminine_plural: "x",
  third_person_masculine_plural: "x",
  third_person_feminine_plural: "x",
};

const IMPERATIVE_TEMPLATE = {
  second_person_masculine_singular: "x",
  second_person_feminine_singular: "x",
  second_person_dual: "x",
  second_person_masculine_plural: "x",
  second_person_feminine_plural: "x",
};

const basePattern = () => ({
  formNumber: 1,
  vocalicTemplate: "فَعَلَ",
  description: "a ~ u",
  rules: { perfect: "{1}َ{2}َ{3}", imperfect_stem: "{1}ْ{2}ُ{3}", masdar: "{1}َ{2}ْ{3}" },
  noAffix: false,
  isLexical: false,
  radical1Kind: "sound" as const,
  radical2Kind: "sound" as const,
  radical3Kind: "sound" as const,
  isGeminate: false,
  perfectVowel: "a" as const,
  imperfectVowel: "u" as const,
});

test("accepts a well-formed form I pattern", () => {
  const result = morphPatternCreateSchema.safeParse(basePattern());
  assert.equal(result.success, true);
});

test("rejects form I without both vowels", () => {
  const result = morphPatternCreateSchema.safeParse({ ...basePattern(), imperfectVowel: null });
  assert.equal(result.success, false);
});

test("rejects a non-form-I pattern that still carries vowels", () => {
  const result = morphPatternCreateSchema.safeParse({ ...basePattern(), formNumber: 2 });
  assert.equal(result.success, false);
});

test("accepts a non-form-I pattern once the vowels are cleared", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    formNumber: 2,
    perfectVowel: null,
    imperfectVowel: null,
  });
  assert.equal(result.success, true);
});

test("rejects a no_affix pattern that leaves a mood as a plain template", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    noAffix: true,
    rules: { perfect: "{1}َ{2}َ{3}", imperfect_indicative: FULL_PERSON_TEMPLATE },
  });
  assert.equal(result.success, false);
});

test("accepts a no_affix pattern once every present mood is spelled out per person", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    noAffix: true,
    rules: {
      perfect: FULL_PERSON_TEMPLATE,
      imperative: IMPERATIVE_TEMPLATE,
      imperfect_indicative: FULL_PERSON_TEMPLATE,
      imperfect_subjunctive: FULL_PERSON_TEMPLATE,
      imperfect_jussive: FULL_PERSON_TEMPLATE,
    },
  });
  assert.equal(result.success, true);
});

test("rejects a shape-resolved pattern with a hamza radical that a template fails to spell out", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    radical1Kind: "hamza",
    rules: { perfect: "{2}َ{3}", imperfect_stem: "{2}ُ{3}" },
  });
  assert.equal(result.success, false);
});

test("accepts the same hamza-radical pattern once every template spells out {1}", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    radical1Kind: "hamza",
    rules: { perfect: "{1}َ{2}َ{3}", imperfect_stem: "{1}ْ{2}ُ{3}" },
  });
  assert.equal(result.success, true);
});

test("skips the hamza-coverage check for lexical patterns", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    isLexical: true,
    radical1Kind: "hamza",
    rules: { perfect: "{2}َ{3}", imperfect_stem: "{2}ُ{3}" },
  });
  assert.equal(result.success, true);
});
