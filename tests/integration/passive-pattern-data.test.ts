import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase, PERSONS } from "../harness";

const db = await openDatabase();

const PASSIVE_KEYS = [
  "passive_perfect",
  "passive_imperfect_stem",
  "passive_imperfect_indicative",
  "passive_imperfect_subjunctive",
  "passive_imperfect_jussive",
];
const PASSIVE_MOOD_KEYS = PASSIVE_KEYS.filter((key) => key !== "passive_imperfect_stem");

interface PatternRules {
  code: string;
  form_number: number;
  radical_count: number;
  perfect_vowel: string | null;
  imperfect_vowel: string | null;
  no_affix: boolean;
  is_lexical: boolean;
  radical1_kind: string;
  radical2_kind: string;
  radical3_kind: string;
  rules: Record<string, string | Record<string, string>>;
}

const patterns = await db.rows<PatternRules>(
  `SELECT code, form_number, radical_count, perfect_vowel::text, imperfect_vowel::text, no_affix, is_lexical,
          radical1_kind::text, radical2_kind::text, radical3_kind::text, rules
   FROM morph_pattern
   ORDER BY form_number, code`,
);
const withPassive = patterns.filter((pattern) => PASSIVE_KEYS.some((key) => key in pattern.rules));

const templatesOf = (pattern: PatternRules): string[] =>
  PASSIVE_KEYS.flatMap((key) => {
    const value = pattern.rules[key];
    if (value === undefined) {
      return [];
    }
    return typeof value === "string" ? [value] : Object.values(value);
  });

test("a good number of patterns carry a passive and every key starting with passive_ is a known one", () => {
  assert.ok(withPassive.length >= 60, `only ${withPassive.length} patterns carry a passive`);
  const known = new Set([...PASSIVE_KEYS, "passive_participle"]);
  for (const pattern of patterns) {
    for (const key of Object.keys(pattern.rules)) {
      if (key.startsWith("passive_")) {
        assert.ok(known.has(key), `${pattern.code} has the unknown key ${key}`);
      }
    }
  }
});

test("a passive is complete: a perfect and an imperfect, never a stem next to explicit moods, never an imperative", () => {
  for (const pattern of withPassive) {
    const { rules } = pattern;
    assert.ok("passive_perfect" in rules, `${pattern.code} has no passive perfect`);
    const explicit = PASSIVE_MOOD_KEYS.filter((key) => key !== "passive_perfect" && key in rules);
    if ("passive_imperfect_stem" in rules) {
      assert.deepEqual(explicit, [], `${pattern.code} combines a passive stem with explicit moods`);
    } else {
      assert.equal(explicit.length, 3, `${pattern.code} lacks a passive imperfect mood`);
    }
    assert.equal("passive_imperative" in rules, false, pattern.code);
  }
});

test("per-person passive objects carry exactly the 13 persons, with no empty cell", () => {
  for (const pattern of withPassive) {
    for (const key of PASSIVE_KEYS) {
      const value = pattern.rules[key];
      if (typeof value !== "object") {
        continue;
      }
      assert.deepEqual(Object.keys(value).sort(), [...PERSONS].sort(), `${pattern.code} ${key}`);
      for (const [person, template] of Object.entries(value)) {
        assert.notEqual(template, "", `${pattern.code} ${key} ${person}`);
      }
    }
  }
});

test("a no-affix pattern spells every passive key out per person", () => {
  for (const pattern of withPassive.filter((candidate) => candidate.no_affix)) {
    for (const key of PASSIVE_KEYS) {
      if (key in pattern.rules) {
        assert.equal(typeof pattern.rules[key], "object", `${pattern.code} ${key}`);
      }
    }
  }
});

test("passive templates use only the placeholders of their radical count and are NFC", () => {
  for (const pattern of withPassive) {
    const placeholders = pattern.radical_count === 4 ? /\{[1234]\}/g : /\{[123]\}/g;
    for (const template of templatesOf(pattern)) {
      assert.equal(template, template.normalize("NFC"), pattern.code);
      assert.equal(template.replace(placeholders, "").includes("{"), false, `${pattern.code}: ${template}`);
      assert.equal(template.replace(placeholders, "").includes("}"), false, `${pattern.code}: ${template}`);
      assert.equal(template.includes("\\"), false, `${pattern.code}: ${template}`);
    }
  }
});

test("only the first form of the sound quadriliteral verb carries a passive, and every one of its templates names the fourth radical", () => {
  const quadriliteral = withPassive.filter((pattern) => pattern.radical_count === 4);
  assert.deepEqual(
    quadriliteral.map((pattern) => pattern.code),
    ["f1-a-i-quadriliteral"],
  );
  for (const pattern of quadriliteral) {
    for (const key of PASSIVE_KEYS.filter((candidate) => candidate in pattern.rules)) {
      const value = pattern.rules[key];
      const joined = typeof value === "string" ? value : Object.values(value ?? {}).join(" ");
      assert.ok(joined.includes("{4}"), `${pattern.code} ${key} misses {4}`);
    }
  }
});

test("a pattern reached by root shape spells a hamza radical as its placeholder in every passive template", () => {
  for (const pattern of withPassive.filter((candidate) => !candidate.is_lexical)) {
    const kinds = [pattern.radical1_kind, pattern.radical2_kind, pattern.radical3_kind];
    kinds.forEach((kind, index) => {
      if (kind !== "hamza") {
        return;
      }
      for (const key of PASSIVE_KEYS) {
        const value = pattern.rules[key];
        if (value === undefined) {
          continue;
        }
        const joined = typeof value === "string" ? value : Object.values(value).join(" ");
        assert.ok(joined.includes(`{${index + 1}}`), `${pattern.code} ${key} misses {${index + 1}}`);
      }
    });
  }
});

test("forms VII and IX and the u ~ u verbs of form I carry no passive: they are neutral or intransitive (Wright 73, 110)", () => {
  for (const pattern of patterns) {
    const neutral =
      pattern.form_number === 7 ||
      pattern.form_number === 9 ||
      (pattern.form_number === 1 && pattern.perfect_vowel === "u" && pattern.imperfect_vowel === "u");
    if (neutral) {
      assert.equal(
        PASSIVE_KEYS.some((key) => key in pattern.rules),
        false,
        pattern.code,
      );
    }
  }
});

test("every shape pattern of form I to VI, VIII and X that a Wiktionary passive table covers carries a passive", () => {
  const expected = [
    "f1-a-u",
    "f1-a-i",
    "f1-a-a",
    "f1-i-a",
    "f1-i-i",
    "f2",
    "f3",
    "f4",
    "f5",
    "f6",
    "f8",
    "f10",
    "f1-a-u-hollow-waw",
    "f4-hollow",
    "f1-a-i-final-weak",
    "f2-final-weak",
    "f1-a-u-geminate",
    "f10-geminate",
  ];
  const carrying = new Set(withPassive.map((pattern) => pattern.code));
  for (const code of expected) {
    assert.ok(carrying.has(code), code);
  }
});

const passiveRulesOf = (pattern: PatternRules): string =>
  JSON.stringify(
    Object.fromEntries(PASSIVE_KEYS.filter((key) => key in pattern.rules).map((key) => [key, pattern.rules[key]])),
  );

const rulesByCode = new Map(patterns.map((pattern) => [pattern.code, passiveRulesOf(pattern)]));

const assertIdentical = (codes: string[], reason: string): void => {
  const distinct = new Set(codes.map((code) => rulesByCode.get(code)));
  assert.equal(distinct.size, 1, `${reason}: ${codes.join(", ")}`);
  assert.notEqual([...distinct][0], "{}", `${reason}: ${codes.join(", ")} carry no passive`);
};

test("the passive of form I does not depend on the vowels of the active (Wright 100, remark)", () => {
  assertIdentical(
    [
      "f1-a-u",
      "f1-a-i",
      "f1-a-a",
      "f1-i-a",
      "f1-i-i",
      "f1-a-u-hamza-elided-in-the-imperative",
      "f1-a-i-assimilated-waw",
      "f1-a-a-assimilated-waw",
      "f1-i-i-assimilated-waw",
      "f1-i-a-assimilated-waw",
      "f1-i-a-assimilated-waw-waw-elided",
      "f1-a-a-hamzated-third",
    ],
    "sound, assimilated and hamzated verbs",
  );
  assertIdentical(
    [
      "f1-a-u-hollow-waw",
      "f1-i-a-hollow-waw",
      "f1-a-i-hollow-ya",
      "f1-i-a-hollow-ya",
      "f1-a-i-hollow-ya-hamzated-third",
      "f1-i-a-hollow-ya-hamzated-third",
      "f1-a-u-hollow-waw-hamzated-third",
    ],
    "hollow verbs",
  );
  assertIdentical(
    [
      "f1-a-i-final-weak",
      "f1-a-u-final-weak-waw",
      "f1-i-a-final-weak",
      "f1-i-a-final-weak-waw",
      "f1-a-a-final-weak",
      "f1-a-i-assimilated-waw-final-weak",
      "f1-i-i-assimilated-waw-final-weak",
      "f1-a-i-hollow-waw-final-weak",
      "f1-i-a-hollow-waw-final-weak",
      "f1-a-a-final-weak-hamzated-middle",
    ],
    "defective verbs",
  );
  assertIdentical(["f1-a-u-geminate", "f1-i-a-geminate", "f1-a-i-geminate"], "geminate verbs");
});

test("the waw and ya twins of the derived defective forms carry the same passive (Wright 169)", () => {
  assertIdentical(["f4-final-weak-ya", "f4-final-weak-waw", "f4-assimilated-waw-final-weak"], "form IV");
  assertIdentical(["f8-final-weak-ya", "f8-final-weak-waw"], "form VIII");
  assertIdentical(["f10-final-weak-ya", "f10-final-weak-waw"], "form X");
});
