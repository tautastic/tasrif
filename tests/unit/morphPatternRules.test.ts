import assert from "node:assert/strict";
import { test } from "node:test";
import { morphPatternRulesSchema } from "../../src/lib/validation/morphPatternRules.ts";

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

test("rejects a placeholder outside {1} {2} {3}", () => {
  const result = morphPatternRulesSchema.safeParse({ perfect: "{1}َ{4}َ{3}" });
  assert.equal(result.success, false);
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
