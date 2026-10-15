import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRoot } from "~/lib/validation/root";
import { openDatabase } from "../harness";

const db = await openDatabase();

const GENERATED_STRINGS = 20_000;
const MAX_GENERATED_LENGTH = 10;

const range = (first: number, last: number): number[] =>
  Array.from({ length: last - first + 1 }, (_, offset) => first + offset);

const codePointsOf = (text: string): number[] => Array.from(text, (character) => character.codePointAt(0) ?? 0);

const ALPHABETS: readonly (readonly number[])[] = [
  [...range(0x0621, 0x063a), ...range(0x0641, 0x064a)],
  codePointsOf("وويىاأإآؤئءةى"),
  range(0x064b, 0x065f),
  [0x0670, 0x0640, ...range(0x06d6, 0x06ed)],
  codePointsOf(" \t\n -"),
  [0x00a0, 0x200c, 0x200d, 0x200e, 0x200f],
  codePointsOf("abc012٠١"),
  [0x06cc, 0x06a9, 0x0671],
];

const mulberry32 = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const generate = (count: number): string[] => {
  const random = mulberry32(20261014);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  return Array.from({ length: count }, () => {
    const length = Math.floor(random() * (MAX_GENERATED_LENGTH + 1));
    return String.fromCodePoint(...Array.from({ length }, () => pick(pick(ALPHABETS))));
  });
};

test("normalizeRoot gives the database's strip_root_noise for thousands of generated strings", async () => {
  const inputs = generate(GENERATED_STRINGS);
  const expected = (
    await db.rows<{ cleaned: string }>(
      `SELECT strip_root_noise(value) AS cleaned
       FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS input(value, position)
       ORDER BY position`,
      [JSON.stringify(inputs)],
    )
  ).map((row) => row.cleaned);

  const differences: string[] = [];
  inputs.forEach((input, index) => {
    const actual = normalizeRoot(input);
    if (actual !== expected[index]) {
      differences.push(
        `${JSON.stringify(input)}: database ${JSON.stringify(expected[index])}, normalizeRoot ${JSON.stringify(actual)}`,
      );
    }
  });
  assert.deepEqual(differences.slice(0, 10), []);
});
