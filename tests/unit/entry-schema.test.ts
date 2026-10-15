import assert from "node:assert/strict";
import { test } from "node:test";
import { entryCreateSchema, entryFormSchema } from "../../src/components/admin/entry-edit-form/schema.ts";
import { overrideCreateSchema } from "../../src/components/admin/lexical-pattern-override-form/schema.ts";
import {
  BARE_ALEF_ROOT_MESSAGE,
  countRadicals,
  hasBareAlef,
  normalizeRoot,
  triliteralRootSchema,
} from "../../src/lib/validation/root.ts";

const sense = (pos: "verb" | "noun") => ({
  pos,
  senseNumber: 1,
  definitions: ["to write"],
  examples: [],
  translations: [],
  relatedSenses: [],
});

const verbEntry = (overrides: Record<string, unknown> = {}) => ({
  language: "ar" as const,
  text: "كَتَبَ",
  root: "كتب",
  verbFormChoice: "form-1-a-u" as const,
  senses: [sense("verb")],
  ...overrides,
});

const nounEntry = (overrides: Record<string, unknown> = {}) => ({
  language: "ar" as const,
  text: "كِتَاب",
  root: "كتب",
  verbFormChoice: null,
  senses: [sense("noun")],
  ...overrides,
});

const rootIssues = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.filter((issue) => issue.path[0] === "root").map((issue) => issue.message) ?? [];

test("normalizeRoot strips whitespace, tatweel, diacritics, hyphens and invisible marks", () => {
  assert.equal(normalizeRoot(" ك ت ب "), "كتب");
  assert.equal(normalizeRoot("كـتـب"), "كتب");
  assert.equal(normalizeRoot("كَتَبَ"), "كتب");
  assert.equal(normalizeRoot("ك-ت-ب"), "كتب");
  assert.equal(normalizeRoot("ك ت‌ب‏"), "كتب");
  assert.equal(normalizeRoot("ًّ"), "");
});

test("normalizeRoot composes a decomposed hamza instead of dropping it", () => {
  assert.equal(normalizeRoot("أكل"), "أكل");
});

test("normalizeRoot writes alef maksura as ya", () => {
  assert.equal(normalizeRoot("رمى"), "رمي");
  assert.equal(normalizeRoot("ىسر"), "يسر");
  assert.equal(normalizeRoot(" ر م ى "), "رمي");
  assert.equal(normalizeRoot("رمي"), "رمي");
});

test("normalizeRoot keeps a bare alef so that the verb check can refuse it", () => {
  assert.equal(normalizeRoot("دعا"), "دعا");
  assert.equal(hasBareAlef("دعا"), true);
  assert.equal(hasBareAlef("دعو"), false);
  assert.equal(hasBareAlef("أكل"), false);
});

test("a verb root written with alef maksura is stored with ya", () => {
  const result = entryCreateSchema.safeParse(verbEntry({ text: "رَمَى", root: "رمى", verbFormChoice: "form-1-a-i" }));
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "رمي");
});

test("a verb root with a bare alef is refused with a hint to write waw or ya", () => {
  const verbSense = entryCreateSchema.safeParse(verbEntry({ root: "دعا" }));
  assert.equal(verbSense.success, false);
  assert.deepEqual(rootIssues(verbSense), [BARE_ALEF_ROOT_MESSAGE]);

  const formChoiceOnly = entryCreateSchema.safeParse(verbEntry({ root: "قال", senses: [sense("noun")] }));
  assert.equal(formChoiceOnly.success, false);
  assert.deepEqual(rootIssues(formChoiceOnly), [BARE_ALEF_ROOT_MESSAGE]);
});

test("a noun root may contain a bare alef", () => {
  const result = entryCreateSchema.safeParse(nounEntry({ text: "دُعَاء", root: "دعا" }));
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "دعا");
});

test("the override root schema folds alef maksura and refuses a bare alef", () => {
  assert.equal(triliteralRootSchema.safeParse("رمى").data, "رمي");
  const refused = triliteralRootSchema.safeParse("دعا");
  assert.equal(refused.success, false);
  assert.deepEqual(
    refused.error?.issues.map((issue) => issue.message),
    [BARE_ALEF_ROOT_MESSAGE],
  );
});

test("countRadicals counts letters, not UTF-16 units", () => {
  assert.equal(countRadicals("كتب"), 3);
  assert.equal(countRadicals("\u{1E900}\u{1E901}"), 2);
});

test("a spaced, voweled root is stored clean", () => {
  const result = entryCreateSchema.safeParse(verbEntry({ root: " ك َ ت ب " }));
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "كتب");
});

test("a verb entry needs exactly three radicals", () => {
  const four = entryCreateSchema.safeParse(verbEntry({ root: "ترجم" }));
  assert.equal(four.success, false);
  assert.deepEqual(rootIssues(four), ["A verb root must have exactly 3 letters"]);

  const two = entryCreateSchema.safeParse(verbEntry({ root: "كت" }));
  assert.equal(two.success, false);
  assert.deepEqual(rootIssues(two), ["A verb root must have exactly 3 letters"]);
});

test("the radical count is taken after normalisation", () => {
  assert.equal(entryCreateSchema.safeParse(verbEntry({ root: "ك ت ب ـ" })).success, true);
  assert.equal(entryCreateSchema.safeParse(verbEntry({ root: "ك ت ب م" })).success, false);
});

test("a non-verb Arabic entry may keep a quadriliteral root", () => {
  const result = entryCreateSchema.safeParse(nounEntry({ root: "ترجم" }));
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "ترجم");
});

test("a root longer than the column is rejected", () => {
  const result = entryCreateSchema.safeParse(nounEntry({ root: "ابتثجحخدذرزس" }));
  assert.equal(result.success, false);
  assert.deepEqual(rootIssues(result), ["Root can have at most 10 letters"]);
});

test("a root made only of noise counts as missing", () => {
  const result = entryCreateSchema.safeParse(nounEntry({ root: " ـ ً " }));
  assert.equal(result.success, false);
  assert.deepEqual(rootIssues(result), ["Root is required for Arabic entries"]);
});

test("a null root is still required for Arabic entries", () => {
  const result = entryCreateSchema.safeParse(nounEntry({ root: null }));
  assert.equal(result.success, false);
  assert.deepEqual(rootIssues(result), ["Root is required for Arabic entries"]);
});

test("an English entry drops whatever was typed into the root field", () => {
  const result = entryCreateSchema.safeParse({
    language: "en",
    text: "book",
    root: "ابتثجحخدذرزس",
    verbFormChoice: null,
    senses: [sense("noun")],
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.root, null);
});

test("text is NFC-normalised and trimmed", () => {
  const result = entryCreateSchema.safeParse(nounEntry({ text: "  آم  " }));
  assert.equal(result.success, true);
  assert.equal(result.data?.text, "آم");
});

test("text is bounded to the varchar(255) column", () => {
  assert.equal(entryCreateSchema.safeParse(nounEntry({ text: "ك".repeat(255) })).success, true);
  const tooLong = entryCreateSchema.safeParse(nounEntry({ text: "ك".repeat(256) }));
  assert.equal(tooLong.success, false);
  assert.equal(tooLong.error?.issues[0]?.path[0], "text");
});

test("the client form schema applies the same root rules", () => {
  assert.equal(entryFormSchema.safeParse(verbEntry({ root: "ك ت ب" })).data?.root, "كتب");
  assert.equal(entryFormSchema.safeParse(verbEntry({ root: "ك ت ب م" })).success, false);
});

const overrideInput = (root: string) => ({
  root,
  formNumber: 1,
  perfectVowel: "a" as const,
  imperfectVowel: "u" as const,
});

test("override roots are normalised to three radicals", () => {
  const result = overrideCreateSchema.safeParse(overrideInput(" ك ت ب "));
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "كتب");
});

test("override roots with the wrong radical count are rejected", () => {
  for (const root of ["", "   ", "كت", "كتبب"]) {
    const result = overrideCreateSchema.safeParse(overrideInput(root));
    assert.equal(result.success, false, `root ${JSON.stringify(root)}`);
    assert.equal(result.error?.issues[0]?.path[0], "root");
  }
});
