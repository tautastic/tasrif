import { AssertionError } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isolate } from "./arabic.ts";

const GOLDEN_DIR = join(import.meta.dirname, "..", "golden");
const MAX_REPORTED_LINES = 25;

export const updatingGoldens = process.env.UPDATE_GOLDENS === "1";

const readGolden = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
};

const writeGolden = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
};

const diffLines = (actual: string, expected: string): string => {
  const left = actual.split("\n");
  const right = expected.split("\n");
  const length = Math.max(left.length, right.length);
  const reported: string[] = [];
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    if (left[index] === right[index]) {
      continue;
    }
    total += 1;
    if (reported.length < MAX_REPORTED_LINES) {
      reported.push(`line ${index + 1}`);
      reported.push(`  golden   ${isolate(right[index] ?? "(missing)")}`);
      reported.push(`  current  ${isolate(left[index] ?? "(missing)")}`);
    }
  }
  if (total > MAX_REPORTED_LINES) {
    reported.push(`... and ${total - MAX_REPORTED_LINES} further differing line(s)`);
  }
  return reported.join("\n");
};

export const assertGolden = async (relativePath: string, content: string): Promise<void> => {
  const path = join(GOLDEN_DIR, relativePath);
  const existing = await readGolden(path);

  if (updatingGoldens) {
    await writeGolden(path, content);
    return;
  }

  if (existing === null) {
    await writeGolden(path, content);
    throw new AssertionError({
      message:
        `No golden existed for ${relativePath}, so one was written from the current output.\n` +
        `Review tests/golden/${relativePath} and commit it if the forms are correct.`,
      operator: "assertGolden",
    });
  }

  if (existing !== content) {
    throw new AssertionError({
      message:
        `Output no longer matches tests/golden/${relativePath}.\n` +
        `If the new forms are correct, rerun with UPDATE_GOLDENS=1 and review the diff.\n\n${diffLines(content, existing)}`,
      actual: content,
      expected: existing,
      operator: "assertGolden",
    });
  }
};
