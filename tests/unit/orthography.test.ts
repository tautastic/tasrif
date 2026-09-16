import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_FUNCTIONS, FUNCTION_CASES, PIPELINE_CASES } from "../fixtures/orthography.ts";
import { assertArabicEqual, describeArabic, normalize, openDatabase } from "../harness";

const db = await openDatabase();

const FUNCTION_NAME_PATTERN = /^normalize_arabic_[a-z_]+$/;

const guardName = (fn: string): string => {
  if (!FUNCTION_NAME_PATTERN.test(fn)) {
    throw new Error(`Refusing to call an unexpected function name: ${fn}`);
  }
  return fn;
};

const callFunction = (fn: string, input: string | null): Promise<string | null> =>
  db.scalar<string | null>(`SELECT ${guardName(fn)}($1)`, [input]);

for (const group of FUNCTION_CASES) {
  test(group.fn, async (t) => {
    for (const testCase of group.cases) {
      await t.test(testCase.name, async () => {
        const actual = await callFunction(group.fn, testCase.input);
        assertArabicEqual(actual, testCase.expected, `${group.fn} applied to ${describeArabic(testCase.input)}`);
      });
    }
  });
}

test("normalize_arabic_orthography composes the sub-functions in a fixed order", async (t) => {
  for (const testCase of PIPELINE_CASES) {
    await t.test(testCase.name, async () => {
      const actual = await normalize(db, testCase.input);
      assertArabicEqual(actual, testCase.expected, `normalization of ${describeArabic(testCase.input)}`);
    });
  }
});

test("the order-sensitive inputs really do discriminate the pipeline order", async (t) => {
  for (const testCase of PIPELINE_CASES) {
    const ordering = testCase.ordering;
    if (!ordering) {
      continue;
    }
    await t.test(testCase.name, async () => {
      const swapped = await db.scalar<string | null>(
        `SELECT ${guardName(ordering.earlier)}(${guardName(ordering.later)}($1))`,
        [testCase.input],
      );
      assert.notEqual(
        swapped,
        testCase.expected,
        `Running ${ordering.later} before ${ordering.earlier} produced the same result, ` +
          `so ${describeArabic(testCase.input)} no longer proves anything about pipeline order`,
      );
    });
  }
});

test("every normalization function is idempotent", async (t) => {
  const inputs = [
    ...FUNCTION_CASES.flatMap((group) => group.cases.flatMap((testCase) => [testCase.input, testCase.expected])),
    ...PIPELINE_CASES.flatMap((testCase) => [testCase.input, testCase.expected]),
  ];
  for (const fn of ALL_FUNCTIONS) {
    await t.test(fn, async () => {
      for (const input of inputs) {
        const once = await callFunction(fn, input);
        const twice = await callFunction(fn, once);
        assertArabicEqual(twice, once, `${fn} was not idempotent for ${describeArabic(input)}`);
      }
    });
  }
});

test("every normalization function passes NULL through", async (t) => {
  for (const fn of ALL_FUNCTIONS) {
    await t.test(fn, async () => {
      assert.equal(await callFunction(fn, null), null);
    });
  }
});

test("every normalization function leaves the empty string empty", async (t) => {
  for (const fn of ALL_FUNCTIONS) {
    await t.test(fn, async () => {
      assert.equal(await callFunction(fn, ""), "");
    });
  }
});

test("every normalization function leaves latin text untouched", async (t) => {
  const latin = "kataba fall-through";
  for (const fn of ALL_FUNCTIONS) {
    await t.test(fn, async () => {
      assert.equal(await callFunction(fn, latin), latin);
    });
  }
});
