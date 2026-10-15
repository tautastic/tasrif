import assert from "node:assert/strict";
import { test } from "node:test";
import {
  morphPatternRulesSchema,
  rulesRadicalCount,
  ruleTemplates,
  usesFourthRadical,
} from "../../src/lib/validation/morphPatternRules.ts";

const FORM_I_A_U_RULES = {
  masdar: "{1}َ{2}ْ{3}",
  perfect: "{1}َ{2}َ{3}",
  imperative: "اُ{1}ْ{2}ُ{3}",
  imperfect_stem: "{1}ْ{2}ُ{3}",
  active_participle: "{1}َا{2}ِ{3}",
  passive_participle: "مَ{1}ْ{2}ُو{3}",
};

const HOLLOW_WAW_PERFECT = {
  second_person_dual: "{1}ُ{3}ْتُمَا",
  first_person_plural: "{1}ُ{3}ْنَا",
  first_person_singular: "{1}ُ{3}ْتُ",
  third_person_feminine_dual: "{1}َا{3}َتَا",
  third_person_masculine_dual: "{1}َا{3}َا",
  third_person_feminine_plural: "{1}ُ{3}ْنَ",
  second_person_feminine_plural: "{1}ُ{3}ْتُنَّ",
  third_person_masculine_plural: "{1}َا{3}ُوا",
  second_person_masculine_plural: "{1}ُ{3}ْتُمْ",
  third_person_feminine_singular: "{1}َا{3}َتْ",
  second_person_feminine_singular: "{1}ُ{3}ْتِ",
  third_person_masculine_singular: "{1}َا{3}َ",
  second_person_masculine_singular: "{1}ُ{3}ْتَ",
};

const IMPERATIVE_5 = {
  second_person_masculine_singular: "اِ{1}ْ{2}ِ{3}ْ",
  second_person_feminine_singular: "{1}ِ{2}ِّي",
  second_person_dual: "{1}ِ{2}َّا",
  second_person_masculine_plural: "{1}ِ{2}ُّوا",
  second_person_feminine_plural: "اِ{1}ْ{2}ِ{3}ْنَ",
};

test("parses the seeded form I plain-template rules", () => {
  const result = morphPatternRulesSchema.safeParse(FORM_I_A_U_RULES);
  assert.equal(result.success, true);
});

test("parses a per-person perfect mood with exactly the 13 persons", () => {
  const result = morphPatternRulesSchema.safeParse({ masdar: "{1}َ{2}ْ{3}", perfect: HOLLOW_WAW_PERFECT });
  assert.equal(result.success, true);
});

test("parses a per-person imperative with exactly the 5 imperative persons", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{2}َ{3}", imperative: IMPERATIVE_5 });
  assert.equal(result.success, true);
});

test("rejects an unknown top-level key", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{2}َ{3}", subjunctive_typo: "x" });
  assert.equal(result.success, false);
});

test("rejects a placeholder outside {1} {2} {3} {4}", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{5}َ{3}" });
  assert.equal(result.success, false);
});

test("accepts the fourth placeholder in a verbal noun, a string mood and a per-person mood", () => {
  assert.equal(morphPatternRulesSchema.safeParse({ masdar: "{1}َ{2}ْ{3}َ{4}َة", perfect: "{1}َ{2}ْ{3}َ{4}" }).success, true);
  assert.equal(
    morphPatternRulesSchema.safeParse({
      perfect: { ...HOLLOW_WAW_PERFECT, first_person_singular: "{1}{2}{3}{4}ْتُ" },
    }).success,
    true,
  );
});

test("the radical count of a rule set is four exactly when some template uses the fourth radical", () => {
  assert.equal(rulesRadicalCount(FORM_I_A_U_RULES), 3);
  assert.equal(rulesRadicalCount({ perfect: "{1}َ{2}َ{3}" }), 3);
  assert.equal(rulesRadicalCount({ masdar: "{1}َ{2}ْ{3}َ{4}َة" }), 4);
  assert.equal(rulesRadicalCount({ imperative: { ...IMPERATIVE_5, second_person_dual: "{4}" } }), 4);
  assert.equal(usesFourthRadical({}), false);
});

test("ruleTemplates lists every string and per-person template with its path", () => {
  const found = ruleTemplates({ masdar: "m", imperative: IMPERATIVE_5, imperfect_stem: "s" });
  assert.deepEqual(found, [
    { path: ["masdar"], template: "m" },
    ...Object.entries(IMPERATIVE_5).map(([person, template]) => ({ path: ["imperative", person], template })),
    { path: ["imperfect_stem"], template: "s" },
  ]);
});

test("rejects a multi-digit placeholder", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{12}َ{3}" });
  assert.equal(result.success, false);
});

test("rejects an imperative object that uses all 13 persons instead of the 5 imperative ones", () => {
  const result = morphPatternRulesSchema.safeParse({
    perfect: "{1}َ{2}َ{3}",
    imperative: HOLLOW_WAW_PERFECT,
  });
  assert.equal(result.success, false);
});

test("rejects a perfect object missing a required person", () => {
  const { third_person_masculine_singular: _drop, ...incomplete } = HOLLOW_WAW_PERFECT;
  const result = morphPatternRulesSchema.safeParse({ perfect: incomplete });
  assert.equal(result.success, false);
});

test("rejects a masdar/participle key given as a per-person object", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{2}َ{3}", masdar: HOLLOW_WAW_PERFECT });
  assert.equal(result.success, false);
});

test("rejects imperfect_stem combined with an explicit imperfect mood", () => {
  const result = morphPatternRulesSchema.safeParse({
    perfect: "{1}َ{2}َ{3}",
    imperfect_stem: "{1}ْ{2}ُ{3}",
    imperfect_indicative: "{1}ُ{2}ُ{3}",
  });
  assert.equal(result.success, false);
});

test("rejects an empty rules object — no mood or stem to ever generate a paradigm", () => {
  const result = morphPatternRulesSchema.safeParse({});
  assert.equal(result.success, false);
});

test("accepts imperfect_stem alone without any explicit imperfect mood", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{2}َ{3}", imperfect_stem: "{1}ْ{2}ُ{3}" });
  assert.equal(result.success, true);
});

const PASSIVE_FORM_I_RULES = {
  ...FORM_I_A_U_RULES,
  passive_perfect: "{1}ُ{2}ِ{3}",
  passive_imperfect_stem: "{1}ْ{2}َ{3}",
};

test("accepts the passive perfect and passive imperfect stem next to the active keys", () => {
  assert.equal(morphPatternRulesSchema.safeParse(PASSIVE_FORM_I_RULES).success, true);
});

test("accepts a per-person passive perfect and per-person passive imperfect moods", () => {
  const result = morphPatternRulesSchema.safeParse({
    perfect: "{1}َ{2}َ{3}",
    passive_perfect: HOLLOW_WAW_PERFECT,
    passive_imperfect_indicative: HOLLOW_WAW_PERFECT,
    passive_imperfect_subjunctive: HOLLOW_WAW_PERFECT,
    passive_imperfect_jussive: HOLLOW_WAW_PERFECT,
  });
  assert.equal(result.success, true);
});

test("rejects a passive imperative: the jussive is used instead (Wright 101)", () => {
  const result = morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_imperative: "{1}ُ{2}َ{3}" });
  assert.equal(result.success, false);
});

test("rejects passive_imperfect_stem combined with an explicit passive imperfect mood", () => {
  const result = morphPatternRulesSchema.safeParse({
    ...PASSIVE_FORM_I_RULES,
    passive_imperfect_jussive: "{1}ُ{2}ُ{3}",
  });
  assert.equal(result.success, false);
});

test("applies the placeholder rules to the passive templates", () => {
  assert.equal(
    morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_perfect: "{1}ُ{5}ِ{3}" }).success,
    false,
  );
  assert.equal(
    morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_perfect: "{1}ُ{2}ِ{3" }).success,
    false,
  );
  assert.equal(
    morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_imperfect_stem: "\\{1}ْ{2}َ{3}" }).success,
    false,
  );
  assert.equal(
    morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_perfect: "ع".repeat(201) }).success,
    false,
  );
});

test("rejects a passive perfect object that uses the 5 imperative persons or misses a person", () => {
  const { third_person_masculine_singular: _drop, ...incomplete } = HOLLOW_WAW_PERFECT;
  assert.equal(
    morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_perfect: incomplete }).success,
    false,
  );
  assert.equal(
    morphPatternRulesSchema.safeParse({ ...PASSIVE_FORM_I_RULES, passive_perfect: IMPERATIVE_5 }).success,
    false,
  );
});

test("rejects rules that carry only passive keys: there is no active paradigm to attach them to", () => {
  const result = morphPatternRulesSchema.safeParse({
    passive_perfect: "{1}ُ{2}ِ{3}",
    passive_imperfect_stem: "{1}ْ{2}َ{3}",
  });
  assert.equal(result.success, false);
});
