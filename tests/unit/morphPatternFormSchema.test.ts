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
  radicalCount: 3,
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

test("accepts a pattern whose rules carry the passive keys", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    rules: { ...basePattern().rules, passive_perfect: "{1}ُ{2}ِ{3}", passive_imperfect_stem: "{1}ْ{2}َ{3}" },
  });
  assert.equal(result.success, true);
});

test("rejects a no_affix pattern that leaves a passive key as a plain template", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    noAffix: true,
    rules: {
      perfect: FULL_PERSON_TEMPLATE,
      imperfect_indicative: FULL_PERSON_TEMPLATE,
      passive_perfect: "{1}ُ{2}ِ{3}",
    },
  });
  assert.equal(result.success, false);
});

test("accepts a no_affix pattern once its passive keys are spelled out per person", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    noAffix: true,
    rules: {
      perfect: FULL_PERSON_TEMPLATE,
      imperfect_indicative: FULL_PERSON_TEMPLATE,
      passive_perfect: FULL_PERSON_TEMPLATE,
      passive_imperfect_indicative: FULL_PERSON_TEMPLATE,
    },
  });
  assert.equal(result.success, true);
});

test("rejects an empty per-person cell of the passive perfect", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    rules: { ...basePattern().rules, passive_perfect: { ...FULL_PERSON_TEMPLATE, first_person_singular: "" } },
  });
  assert.equal(result.success, false);
});

test("requires a passive template of a hamza-radical pattern to spell out the hamza", () => {
  const rules = { perfect: "{1}َ{2}َ{3}", imperfect_stem: "{1}ْ{2}ُ{3}" };
  const base = { ...basePattern(), radical1Kind: "hamza" as const };
  assert.equal(
    morphPatternCreateSchema.safeParse({ ...base, rules: { ...rules, passive_perfect: "{2}ُ{3}" } }).success,
    false,
  );
  assert.equal(
    morphPatternCreateSchema.safeParse({ ...base, rules: { ...rules, passive_perfect: "{1}ُ{2}ِ{3}" } }).success,
    true,
  );
});

const quadPattern = (overrides: Record<string, unknown> = {}) => ({
  ...basePattern(),
  radicalCount: 4,
  description: "quadriliteral",
  rules: { perfect: "{1}َ{2}ْ{3}َ{4}", imperfect_stem: "{1}َ{2}ْ{3}ِ{4}", masdar: "{1}َ{2}ْ{3}َ{4}َة" },
  imperfectVowel: "i" as const,
  ...overrides,
});

const issueMessages = (result: ReturnType<typeof morphPatternCreateSchema.safeParse>) =>
  result.error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) ?? [];

test("a pattern for four radicals is accepted when it uses the fourth radical and stays sound", () => {
  assert.equal(morphPatternCreateSchema.safeParse(quadPattern()).success, true);
  assert.equal(
    morphPatternCreateSchema.safeParse(quadPattern({ formNumber: 2, perfectVowel: null, imperfectVowel: null }))
      .success,
    true,
  );
});

test("the radical count defaults to three and must be three or four", () => {
  const { radicalCount: _omitted, ...withoutCount } = basePattern();
  assert.equal(morphPatternCreateSchema.safeParse(withoutCount).data?.radicalCount, 3);
  assert.equal(morphPatternCreateSchema.safeParse({ ...basePattern(), radicalCount: 5 }).success, false);
  assert.equal(morphPatternCreateSchema.safeParse({ ...basePattern(), radicalCount: 2 }).success, false);
});

test("a pattern for three radicals refuses the fourth placeholder where it is used", () => {
  const result = morphPatternCreateSchema.safeParse({
    ...basePattern(),
    rules: { perfect: { ...FULL_PERSON_TEMPLATE, third_person_masculine_singular: "{1}{4}" }, masdar: "{4}" },
  });
  assert.equal(result.success, false);
  const messages = issueMessages(result);
  assert.ok(
    messages.some((message) => /^rules\.masdar: Unknown placeholder "\{4\}"/.test(message)),
    messages.join("\n"),
  );
  assert.ok(
    messages.some((message) =>
      /^rules\.perfect\.third_person_masculine_singular: Unknown placeholder "\{4\}"/.test(message),
    ),
    messages.join("\n"),
  );
});

test("a pattern for four radicals must use the fourth radical somewhere", () => {
  const result = morphPatternCreateSchema.safeParse(quadPattern({ rules: { perfect: "{1}َ{2}ْ{3}" } }));
  assert.equal(result.success, false);
  assert.ok(
    issueMessages(result).some((message) =>
      /^rules: A pattern for four radicals must use the fourth radical/.test(message),
    ),
  );
});

test("a pattern for four radicals has forms I to IV and no weak or geminate shape", () => {
  assert.ok(
    issueMessages(
      morphPatternCreateSchema.safeParse(quadPattern({ formNumber: 5, perfectVowel: null, imperfectVowel: null })),
    ).some((message) => /^formNumber: The quadriliteral verb has forms I to IV only/.test(message)),
  );
  const weak = morphPatternCreateSchema.safeParse(quadPattern({ radical2Kind: "waw" }));
  assert.ok(
    issueMessages(weak).some((message) => /^radical2Kind: A weak letter before the last radical/.test(message)),
  );
  const geminate = morphPatternCreateSchema.safeParse(quadPattern({ isGeminate: true }));
  assert.ok(
    issueMessages(geminate).some((message) => /^isGeminate: A quadriliteral pattern is not geminate/.test(message)),
  );
});

test("the last radical of a pattern for four radicals may be waw or ya, never a hamza, and defaults to sound", () => {
  assert.equal(morphPatternCreateSchema.safeParse(quadPattern()).data?.radical4Kind, "sound");
  for (const kind of ["sound", "waw", "ya"]) {
    assert.equal(morphPatternCreateSchema.safeParse(quadPattern({ radical4Kind: kind })).success, true, kind);
  }
  const hamza = morphPatternCreateSchema.safeParse(quadPattern({ radical4Kind: "hamza" }));
  assert.ok(
    issueMessages(hamza).some((message) =>
      /^radical4Kind: A hamza as the last radical is written like a sound letter/.test(message),
    ),
  );
});

test("a pattern for three radicals has no fourth radical to make weak", () => {
  const result = morphPatternCreateSchema.safeParse({ ...basePattern(), radical4Kind: "ya" });
  assert.equal(result.success, false);
  assert.ok(
    issueMessages(result).some((message) =>
      /^radical4Kind: A pattern for three radicals has no fourth radical: leave it Sound/.test(message),
    ),
  );
  assert.equal(morphPatternCreateSchema.safeParse(basePattern()).data?.radical4Kind, "sound");
});
