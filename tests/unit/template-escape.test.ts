import assert from "node:assert/strict";
import { test } from "node:test";
import { toDisplayTemplate, toRawTemplate } from "~/components/admin/morph-pattern-edit-form/radicalPlaceholders";
import {
  findTemplateProblem,
  MAX_TEMPLATE_LENGTH,
  morphPatternRulesSchema,
  PERSONS,
} from "~/lib/validation/morphPatternRules";

const BACKSLASH = "\\";

const ALPHABET = [
  "ف",
  "ع",
  "ل",
  "ب",
  "ك",
  "ت",
  "ا",
  "ي",
  "و",
  "ء",
  "م",
  "َ",
  "ُ",
  "ِ",
  "ّ",
  "ْ",
  "ً",
  "{",
  "}",
  "1",
  "2",
  "3",
  "4",
  BACKSLASH,
  BACKSLASH,
  "x",
  " ",
];

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const generateStrings = (count: number, maxLength: number, seed: number): string[] => {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => {
    const length = Math.floor(random() * (maxLength + 1));
    return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
  });
};

const hasTypedPlaceholder = (display: string) => /\{[123]\}/.test(display);

const SAMPLES = generateStrings(30000, 14, 20260101);

test("the generated sample covers every alphabet symbol and several lengths", () => {
  const seen = new Set(SAMPLES.join(""));
  for (const symbol of ALPHABET) {
    assert.ok(seen.has(symbol), `symbol ${JSON.stringify(symbol)} never generated`);
  }
  assert.ok(SAMPLES.some((sample) => sample === ""));
  assert.ok(SAMPLES.some((sample) => sample.length === 14));
});

test("an unescaped ف ع ل becomes the canonical placeholder", () => {
  assert.equal(toRawTemplate("فعل"), "{1}{2}{3}");
  assert.equal(toRawTemplate("فَعَلَ"), "{1}َ{2}َ{3}َ");
  assert.equal(toRawTemplate("اِفْتَعَلَ"), "اِ{1}ْتَ{2}َ{3}َ");
});

test("a backslash before ف ع ل stores the letter literally", () => {
  assert.equal(toRawTemplate("\\ف"), "ف");
  assert.equal(toRawTemplate("\\ع"), "ع");
  assert.equal(toRawTemplate("\\ل"), "ل");
  assert.equal(toRawTemplate("ت\\فْ"), "تفْ");
  assert.equal(toRawTemplate("\\فع\\ل"), "ف{2}ل");
});

test("pairs of backslashes collapse and the parity decides whether the letter is literal", () => {
  assert.equal(toRawTemplate("\\\\ف"), "\\{1}");
  assert.equal(toRawTemplate("\\\\\\ف"), "\\ف");
  assert.equal(toRawTemplate("\\\\\\\\ف"), "\\\\{1}");
  assert.equal(toRawTemplate("\\\\\\\\\\ف"), "\\\\ف");
});

test("backslashes that do not precede ف ع ل are plain characters", () => {
  assert.equal(toRawTemplate("\\"), "\\");
  assert.equal(toRawTemplate("\\\\"), "\\\\");
  assert.equal(toRawTemplate("\\ب"), "\\ب");
  assert.equal(toRawTemplate("ب\\"), "ب\\");
});

test("stored literal letters are shown with a backslash and placeholders as the bare letter", () => {
  assert.equal(toDisplayTemplate("{1}{2}{3}"), "فعل");
  assert.equal(toDisplayTemplate("ف"), "\\ف");
  assert.equal(toDisplayTemplate("{1}ف{3}"), "ف\\فل");
  assert.equal(toDisplayTemplate("\\{1}"), "\\\\ف");
  assert.equal(toDisplayTemplate("\\ف"), "\\\\\\ف");
});

test("display to stored and back is exact for every typed text without a typed {n} token", () => {
  let checked = 0;
  for (const display of SAMPLES) {
    if (hasTypedPlaceholder(display)) {
      continue;
    }
    assert.equal(toDisplayTemplate(toRawTemplate(display)), display, JSON.stringify(display));
    checked += 1;
  }
  assert.ok(checked > 20000, `only ${checked} samples checked`);
});

test("stored to display and back is exact for every stored string", () => {
  for (const raw of SAMPLES) {
    assert.equal(toRawTemplate(toDisplayTemplate(raw)), raw, JSON.stringify(raw));
  }
});

test("already escaped input survives another pass", () => {
  for (const display of SAMPLES) {
    if (hasTypedPlaceholder(display)) {
      continue;
    }
    const once = toRawTemplate(display);
    assert.equal(toRawTemplate(toDisplayTemplate(once)), once, JSON.stringify(display));
  }
  const escaped = "\\ف\\\\ف\\\\\\ف";
  assert.equal(toDisplayTemplate(toRawTemplate(escaped)), escaped);
});

test("a typed {1} {2} {3} is accepted and normalised to the letter without changing what is stored", () => {
  assert.equal(toRawTemplate("{1}َ{2}"), "{1}َ{2}");
  assert.equal(toDisplayTemplate(toRawTemplate("{1}َ{2}")), "فَع");
  for (const display of SAMPLES.filter(hasTypedPlaceholder)) {
    const canonical = toDisplayTemplate(toRawTemplate(display));
    assert.equal(toRawTemplate(canonical), toRawTemplate(display), JSON.stringify(display));
    assert.equal(toDisplayTemplate(toRawTemplate(canonical)), canonical, JSON.stringify(display));
  }
});

test("the number of stored placeholders equals the number of unescaped radical letters", () => {
  const countUnescaped = (display: string) => {
    let count = 0;
    let backslashes = 0;
    for (const char of display) {
      if (char === BACKSLASH) {
        backslashes += 1;
        continue;
      }
      if ("فعل".includes(char) && backslashes % 2 === 0) {
        count += 1;
      }
      backslashes = 0;
    }
    return count;
  };
  for (const display of SAMPLES) {
    if (hasTypedPlaceholder(display)) {
      continue;
    }
    const placeholders = toRawTemplate(display).match(/\{[123]\}/g) ?? [];
    assert.equal(placeholders.length, countUnescaped(display), JSON.stringify(display));
  }
});

test("the stored form never contains a bare letter that was typed as a placeholder", () => {
  const raw = toRawTemplate("فَعَلَ");
  assert.equal(/[فعل]/.test(raw), false);
  const literal = toRawTemplate("\\فَعَلَ");
  assert.equal(literal, "فَ{2}َ{3}َ");
});

test("a template with a literal radical letter is accepted by the rules schema and kept verbatim", () => {
  const stored = toRawTemplate("تَ\\فَ{2}َّ\\ل");
  const result = morphPatternRulesSchema.safeParse({ perfect: stored, masdar: "{1}َ{2}ْ{3}" });
  assert.equal(result.success, true);
  assert.equal(result.data?.perfect, "تَفَ{2}َّل");
});

test("malformed placeholders are rejected with the offending token in the message", () => {
  assert.match(findTemplateProblem("{1}َ{5}َ{3}") ?? "", /Unknown placeholder "\{5\}"/);
  assert.match(findTemplateProblem("{12}") ?? "", /Unknown placeholder "\{12\}"/);
  assert.match(findTemplateProblem("{}") ?? "", /Unknown placeholder "\{\}"/);
  assert.match(findTemplateProblem("{ 1}") ?? "", /Unknown placeholder "\{ 1\}"/);
  assert.match(findTemplateProblem("{a}") ?? "", /Unknown placeholder "\{a\}"/);
  assert.match(findTemplateProblem("{0}") ?? "", /Unknown placeholder "\{0\}"/);
});

test("the fourth placeholder is a valid token of the template language", () => {
  assert.equal(findTemplateProblem("{1}َ{2}ْ{3}َ{4}َة"), null);
  assert.equal(findTemplateProblem("{4}"), null);
});

test("ق is the fourth radical only in a pattern for four radicals, and a literal ق stays a letter otherwise", () => {
  assert.equal(toRawTemplate("فَعْلَقَ", 4), "{1}َ{2}ْ{3}َ{4}َ");
  assert.equal(toRawTemplate("فَعْلَقَ"), "{1}َ{2}ْ{3}َقَ");
  assert.equal(toRawTemplate("فَعْلَقَ", 3), "{1}َ{2}ْ{3}َقَ");
  assert.equal(toDisplayTemplate("{1}َ{2}ْ{3}َ{4}َ", 4), "فَعْلَقَ");
  assert.equal(toDisplayTemplate("{1}َ{2}ْ{3}َقَ", 3), "فَعْلَقَ");
  assert.equal(toDisplayTemplate("{1}َ{2}ْ{3}َقَ", 4), "فَعْلَ\\قَ");
  assert.equal(toRawTemplate("\\قَ", 4), "قَ");
});

test("a four-radical template survives the round trip between the typed and the stored form", () => {
  for (const display of ["فَعْلَقَ", "مُفَعْلِق", "تَفَعْلُق", "اِفْعَنْلَقَ", "اِفْعِنْلَاق", "\\ق\\ف{4}"]) {
    const raw = toRawTemplate(display, 4);
    assert.equal(toRawTemplate(toDisplayTemplate(raw, 4), 4), raw, JSON.stringify(display));
  }
  assert.equal(toRawTemplate("تَفَعْلُق", 4), "تَ{1}َ{2}ْ{3}ُ{4}");
});

test("unbalanced braces and stored backslashes are rejected", () => {
  assert.match(findTemplateProblem("{1") ?? "", /Unmatched brace/);
  assert.match(findTemplateProblem("{1}}") ?? "", /Unmatched brace/);
  assert.match(findTemplateProblem("}{1}") ?? "", /Unmatched brace/);
  assert.match(findTemplateProblem("{{1}") ?? "", /Unmatched brace/);
  assert.match(findTemplateProblem("\\ف") ?? "", /backslash/);
});

test("well formed templates have no problem", () => {
  for (const template of ["", "{1}", "{1}{2}{3}", "مَ{1}ْ{2}ُو{3}", "ف", "ع{1}ل", "اِ{1}ْ{2}ِ{3}ْنَ"]) {
    assert.equal(findTemplateProblem(template), null, template);
  }
});

test("the rules schema surfaces the problem message at the path of a per-person template", () => {
  const perfect = Object.fromEntries(PERSONS.map((person) => [person, "{1}ُ{2}"]));
  perfect.first_person_singular = "{1}ُ{9}ْتُ";
  const result = morphPatternRulesSchema.safeParse({ perfect });
  assert.equal(result.success, false);
  const issue = result.error?.issues[0];
  assert.deepEqual(issue?.path, ["perfect", "first_person_singular"]);
  assert.ok(issue?.message.includes('"{9}"'), issue?.message);
});

test("a template longer than the limit is rejected", () => {
  assert.equal(morphPatternRulesSchema.safeParse({ perfect: "ب".repeat(MAX_TEMPLATE_LENGTH) }).success, true);
  assert.equal(morphPatternRulesSchema.safeParse({ perfect: "ب".repeat(MAX_TEMPLATE_LENGTH + 1) }).success, false);
});
