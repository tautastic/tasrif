import { AssertionError } from "node:assert";
import { compareArabic, compareParadigm } from "./arabic.ts";
import type { SqlFailure } from "./client.ts";

export const assertArabicEqual = (actual: string | null, expected: string | null, context?: string): void => {
  if (actual === expected) {
    return;
  }
  const heading = context ? `${context}\n` : "";
  throw new AssertionError({
    message: `${heading}${compareArabic(actual, expected)}`,
    actual,
    expected,
    operator: "assertArabicEqual",
  });
};

export const assertParadigmEqual = (
  actual: Record<string, string | null>,
  expected: Record<string, string | null>,
  context?: string,
): void => {
  const differences = compareParadigm(actual, expected);
  if (differences.length === 0) {
    return;
  }
  const heading = context ? `${context}\n` : "";
  throw new AssertionError({
    message: `${heading}${differences.length} cell(s) differ\n\n${differences.join("\n\n")}`,
    actual,
    expected,
    operator: "assertParadigmEqual",
  });
};

export const assertSqlState = (failure: SqlFailure, code: string, messagePattern?: RegExp): void => {
  if (failure.code !== code) {
    throw new AssertionError({
      message: `Expected SQLSTATE ${code} but received ${failure.code || "(none)"}: ${failure.message}`,
      actual: failure.code,
      expected: code,
      operator: "assertSqlState",
    });
  }
  if (messagePattern && !messagePattern.test(failure.message)) {
    throw new AssertionError({
      message: `Error message did not match ${messagePattern}: ${failure.message}`,
      actual: failure.message,
      expected: String(messagePattern),
      operator: "assertSqlState",
    });
  }
};
