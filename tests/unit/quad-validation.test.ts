import assert from "node:assert/strict";
import { test } from "node:test";
import { entryCreateSchema } from "../../src/components/admin/entry-edit-form/schema.ts";
import { formatMorphPatternFormNumber } from "../../src/lib/formatting.ts";
import { morphPatternPreviewInputSchema } from "../../src/lib/validation/morphPatternPreview.ts";
import { BARE_ALEF_ROOT_MESSAGE, rootLengthMessage, verbRootSchema } from "../../src/lib/validation/root.ts";
import { invalidRootMessage, mapPatternSaveError } from "../../src/server/actions/save-errors.ts";

const sense = (pos: "verb" | "noun") => ({
  pos,
  senseNumber: 1,
  definitions: ["to translate"],
  examples: [],
  translations: [],
  relatedSenses: [],
});

const verbEntry = (overrides: Record<string, unknown> = {}) => ({
  language: "ar" as const,
  text: "تَرْجَمَ",
  root: "ترجم",
  verbFormChoice: "form-1q" as const,
  senses: [sense("verb")],
  ...overrides,
});

const rootIssues = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.filter((issue) => issue.path[0] === "root").map((issue) => issue.message) ?? [];

const QUAD_RULES = { perfect: "{1}َ{2}ْ{3}َ{4}", masdar: "{1}َ{2}ْ{3}َ{4}َة" };
const TRI_RULES = { perfect: "{1}َ{2}َ{3}", masdar: "{1}َ{2}ْ{3}" };

test("a quadriliteral verb form choice takes a four-letter root", () => {
  for (const choice of ["form-1q", "form-2q", "form-3q", "form-4q"] as const) {
    const result = entryCreateSchema.safeParse(verbEntry({ verbFormChoice: choice }));
    assert.equal(result.success, true, choice);
    assert.equal(result.data?.root, "ترجم");
    assert.equal(result.data?.verbFormChoice, choice);
  }
});

test("a quadriliteral verb form choice refuses a root of any other length and says how many letters it needs", () => {
  for (const root of ["كتب", "ك", "كتبمنه"]) {
    const result = entryCreateSchema.safeParse(verbEntry({ root }));
    assert.equal(result.success, false, root);
    assert.deepEqual(rootIssues(result), ["A quadriliteral verb root must have exactly 4 letters"], root);
  }
});

test("a triliteral verb form choice still refuses four letters with the old message", () => {
  const result = entryCreateSchema.safeParse(verbEntry({ verbFormChoice: "form-1-a-u" }));
  assert.equal(result.success, false);
  assert.deepEqual(rootIssues(result), ["A verb root must have exactly 3 letters"]);
});

test("a verb sense with no form chosen yet accepts three or four letters and refuses the rest", () => {
  assert.deepEqual(rootIssues(entryCreateSchema.safeParse(verbEntry({ verbFormChoice: null }))), []);
  assert.deepEqual(rootIssues(entryCreateSchema.safeParse(verbEntry({ verbFormChoice: null, root: "كتب" }))), []);
  assert.deepEqual(rootIssues(entryCreateSchema.safeParse(verbEntry({ verbFormChoice: null, root: "كتبمنه" }))), [
    "A verb root must have 3 or 4 letters",
  ]);
  assert.deepEqual(rootIssues(entryCreateSchema.safeParse(verbEntry({ verbFormChoice: null, root: "كت" }))), [
    "A verb root must have 3 or 4 letters",
  ]);
});

test("a four-letter verb root with a bare alef is refused with the hint", () => {
  const result = entryCreateSchema.safeParse(verbEntry({ root: "طاعم" }));
  assert.deepEqual(rootIssues(result), [BARE_ALEF_ROOT_MESSAGE]);
});

test("a spaced, voweled four-letter root is stored clean", () => {
  const result = entryCreateSchema.safeParse(verbEntry({ root: " ت َ ر-ج م " }));
  assert.equal(result.data?.root, "ترجم");
});

test("a noun entry is not held to a verb root length and keeps its quadriliteral root", () => {
  const result = entryCreateSchema.safeParse({
    language: "ar",
    text: "تَرْجَمَة",
    root: "ترجم",
    verbFormChoice: null,
    senses: [sense("noun")],
  });
  assert.equal(result.success, true);
});

test("the preview takes a four-letter root when the rules use the fourth radical", () => {
  const result = morphPatternPreviewInputSchema.safeParse({
    root: " د ح ر ج ",
    rules: QUAD_RULES,
    formNumber: 1,
    noAffix: false,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "دحرج");
});

test("the preview insists on the radical count of the rules and names it", () => {
  const issues = (root: string, rules: object) =>
    morphPatternPreviewInputSchema
      .safeParse({ root, rules, formNumber: 1, noAffix: false })
      .error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  assert.deepEqual(issues("دحرج", TRI_RULES), ["root: Root must have exactly 3 letters"]);
  assert.deepEqual(issues("ك", TRI_RULES), ["root: Root must have exactly 3 letters"]);
  assert.deepEqual(issues("كتب", QUAD_RULES), ["root: Root must have exactly 4 letters"]);
  assert.equal(issues("كتب", TRI_RULES), undefined);
  assert.equal(issues("دحرج", QUAD_RULES), undefined);
});

test("the preview refuses a bare alef whatever the radical count", () => {
  const result = morphPatternPreviewInputSchema.safeParse({
    root: "قال",
    rules: TRI_RULES,
    formNumber: 1,
    noAffix: false,
  });
  assert.equal(result.success, false);
  assert.ok(result.error?.issues.some((issue) => issue.message === BARE_ALEF_ROOT_MESSAGE));
});

test("verbRootSchema normalises a root and refuses an empty one or a bare alef without counting letters", () => {
  assert.equal(verbRootSchema.safeParse("د ح رج").data, "دحرج");
  assert.equal(verbRootSchema.safeParse("ك").data, "ك");
  assert.equal(verbRootSchema.safeParse("").success, false);
  assert.equal(verbRootSchema.safeParse("دعا").success, false);
  assert.equal(rootLengthMessage(4), "Root must have exactly 4 letters");
});

test("form numbers carry the q of the quadriliteral forms", () => {
  assert.equal(formatMorphPatternFormNumber(1, 4), "Iq");
  assert.equal(formatMorphPatternFormNumber(2, 4), "IIq");
  assert.equal(formatMorphPatternFormNumber(3, 4), "IIIq");
  assert.equal(formatMorphPatternFormNumber(4, 4), "IVq");
  assert.equal(formatMorphPatternFormNumber(4), "IV");
  assert.equal(formatMorphPatternFormNumber(4, 3), "IV");
});

test("the save errors name the kind of root that was refused", () => {
  assert.equal(invalidRootMessage("كتب", 4), "Root 'كتب' is not a valid quadriliteral root");
  assert.equal(invalidRootMessage("ترجم"), "Root 'ترجم' is not a valid triliteral root");
  assert.equal(invalidRootMessage("ترجم", 3), "Root 'ترجم' is not a valid triliteral root");
  const duplicate = { code: "23505", constraint: "unique_form_number_description", message: "duplicate" };
  const failure = mapPatternSaveError(duplicate, { formNumber: 2, radicalCount: 4, description: "quadriliteral" });
  assert.equal(failure.ok, false);
  assert.equal(failure.ok ? "" : failure.error, 'A form IIq pattern with description "quadriliteral" already exists');
});
