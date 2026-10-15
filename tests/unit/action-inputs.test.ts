import assert from "node:assert/strict";
import { test } from "node:test";
import { idListSchema, MAX_BULK_IDS } from "../../src/lib/validation/ids.ts";
import { morphPatternPreviewInputSchema } from "../../src/lib/validation/morphPatternPreview.ts";

test("an id list keeps valid ids and removes duplicates", () => {
  assert.deepEqual(idListSchema.parse([3, 1, 3, 2, 1]), [3, 1, 2]);
  assert.deepEqual(idListSchema.parse([]), []);
});

test("an id list rejects anything that is not a positive safe integer", () => {
  for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
    assert.equal(idListSchema.safeParse([1, bad]).success, false, `id ${String(bad)}`);
  }
  assert.equal(idListSchema.safeParse("1,2").success, false);
  assert.equal(idListSchema.safeParse(undefined).success, false);
});

test("an id list is bounded", () => {
  assert.equal(idListSchema.safeParse(Array.from({ length: MAX_BULK_IDS }, (_, i) => i + 1)).success, true);
  assert.equal(idListSchema.safeParse(Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => i + 1)).success, false);
});

const previewInput = (overrides: Record<string, unknown> = {}) => ({
  root: "كتب",
  rules: { perfect: "{1}َ{2}َ{3}", imperfect_stem: "{1}ْ{2}ُ{3}" },
  formNumber: 1,
  noAffix: false,
  ...overrides,
});

test("a well-formed preview input is accepted and its root normalised", () => {
  const result = morphPatternPreviewInputSchema.safeParse(previewInput({ root: " ك ت ب " }));
  assert.equal(result.success, true);
  assert.equal(result.data?.root, "كتب");
});

test("a preview root must have exactly three letters and a bounded length", () => {
  for (const root of ["", "كت", "كتبب", "ك".repeat(5000)]) {
    assert.equal(morphPatternPreviewInputSchema.safeParse(previewInput({ root })).success, false);
  }
});

test("preview rules go through the pattern rules schema", () => {
  assert.equal(morphPatternPreviewInputSchema.safeParse(previewInput({ rules: {} })).success, false);
  assert.equal(morphPatternPreviewInputSchema.safeParse(previewInput({ rules: { perfect: "{9}" } })).success, false);
  assert.equal(morphPatternPreviewInputSchema.safeParse(previewInput({ rules: { unknown: "x" } })).success, false);
  assert.equal(morphPatternPreviewInputSchema.safeParse(previewInput({ rules: "perfect" })).success, false);
});

test("preview form number and flags are validated", () => {
  for (const overrides of [{ formNumber: 0 }, { formNumber: 11 }, { formNumber: 1.5 }, { noAffix: "yes" }]) {
    assert.equal(morphPatternPreviewInputSchema.safeParse(previewInput(overrides)).success, false);
  }
});
