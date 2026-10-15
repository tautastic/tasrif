import assert from "node:assert/strict";
import { test } from "node:test";
import { entrySlug } from "~/lib/slug";
import { openDatabase } from "../harness";

const db = await openDatabase();

const GENERATED_STRINGS = 20_000;
const MAX_GENERATED_LENGTH = 24;
const MAX_UNICODE_VERSION_GAP = 300;
const FIRST_SURROGATE = 0xd800;
const LAST_SURROGATE = 0xdfff;
const LAST_CODE_POINT = 0x10ffff;

const range = (first: number, last: number): number[] =>
  Array.from({ length: last - first + 1 }, (_, offset) => first + offset);

const codePointsOf = (text: string): number[] => Array.from(text, (character) => character.codePointAt(0) ?? 0);

const ALPHABETS: readonly (readonly number[])[] = [
  [...range(0x0621, 0x063a), ...range(0x0641, 0x064a)],
  [...range(0x064b, 0x065f), 0x0670, 0x0640],
  [0x06cc, 0x06a9, 0x0671, 0x06c1, 0x067e, 0x06d2],
  [...range(0xfb50, 0xfb60), ...range(0xfe70, 0xfefc), 0xfdf2],
  codePointsOf("abcdefghijklmnopqrstuvwxyz"),
  codePointsOf("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  codePointsOf("0123456789٠١٢٣٤٥٦٧٨٩"),
  codePointsOf("éÉñüçßαΣσ"),
  codePointsOf(" \t\n_ -- "),
  [0x00a0, 0x2003, 0x3000, 0x2028],
  codePointsOf("!\"#$%&'()*+,./:;<=>?@[\\]^`{|}~"),
  [0x2013, 0x2014, 0x2212, 0x2018, 0x201c, 0x00ab, 0x00bb, 0x060c, 0x061b, 0x061f, 0x200b, 0x200f, 0xfeff],
  range(0x0300, 0x036f),
  range(0x1f600, 0x1f64f),
  [...range(0xff21, 0xff3a), ...range(0xff41, 0xff5a), 0xff0d],
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
  const random = mulberry32(20261013);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  return Array.from({ length: count }, () => {
    const length = Math.floor(random() * (MAX_GENERATED_LENGTH + 1));
    return String.fromCodePoint(...Array.from({ length }, () => pick(pick(ALPHABETS))));
  });
};

const slugsInDatabase = async (inputs: readonly string[]): Promise<string[]> =>
  (
    await db.rows<{ slug: string }>(
      `SELECT entry_slug(value) AS slug
       FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS input(value, position)
       ORDER BY position`,
      [JSON.stringify(inputs)],
    )
  ).map((row) => row.slug);

test("the TypeScript mirror gives the database's slug for thousands of generated strings", async () => {
  const inputs = generate(GENERATED_STRINGS);
  const expected = await slugsInDatabase(inputs);
  const differences: string[] = [];
  inputs.forEach((input, index) => {
    const actual = entrySlug(input);
    if (actual !== expected[index]) {
      differences.push(
        `${JSON.stringify(input)}: database ${JSON.stringify(expected[index])}, mirror ${JSON.stringify(actual)}`,
      );
    }
  });
  assert.deepEqual(differences.slice(0, 10), []);
});

test("the generated strings exercise every branch of the rules", () => {
  const slugs = generate(GENERATED_STRINGS).map(entrySlug);
  assert.ok(slugs.some((slug) => slug === ""));
  assert.ok(slugs.some((slug) => slug.includes("-")));
  assert.ok(slugs.some((slug) => /\p{Script=Arabic}/u.test(slug)));
  assert.ok(slugs.some((slug) => /[a-z]/.test(slug)));
  assert.ok(slugs.some((slug) => /[0-9٠-٩]/.test(slug)));
  assert.ok(slugs.filter((slug) => slug !== "").length > GENERATED_STRINGS / 2);
});

test("the slug of a generated string is its own slug, in the database and in the mirror", async () => {
  const slugs = await slugsInDatabase(generate(GENERATED_STRINGS));
  assert.deepEqual(await slugsInDatabase(slugs), slugs);
  assert.deepEqual(slugs.map(entrySlug), slugs);
});

test("a slug has no edge hyphen, no double hyphen and no whitespace", async () => {
  for (const slug of await slugsInDatabase(generate(GENERATED_STRINGS))) {
    assert.equal(/^-|-$|--|\s/u.test(slug), false, JSON.stringify(slug));
  }
});

test("every code point is treated the same by the mirror and the database", async () => {
  const rows = await db.rows<{ code_point: number; slug: string; known: boolean }>(
    `SELECT code_point,
            entry_slug('a' || chr(code_point) || 'b') AS slug,
            lower(normalize(chr(code_point), NFKC)) <> chr(code_point) AS known
     FROM generate_series(1, $1::int) AS code_point
     WHERE code_point NOT BETWEEN $2::int AND $3::int`,
    [LAST_CODE_POINT, FIRST_SURROGATE, LAST_SURROGATE],
  );
  assert.equal(rows.length, LAST_CODE_POINT - (LAST_SURROGATE - FIRST_SURROGATE + 1));

  const unexplained: string[] = [];
  let versionGap = 0;
  for (const { code_point, slug, known } of rows) {
    const character = String.fromCodePoint(code_point);
    const plain = `a${character}b`;
    const mirrored = entrySlug(plain);
    if (mirrored === slug) {
      continue;
    }
    const mirrorKnows = character.normalize("NFKC").toLowerCase() !== character;
    const databaseOnlyKeepsIt = slug === plain && mirrorKnows;
    const mirrorOnlyKeepsIt = mirrored === plain && known;
    if (databaseOnlyKeepsIt || mirrorOnlyKeepsIt) {
      versionGap += 1;
    } else {
      unexplained.push(
        `U+${code_point.toString(16).toUpperCase()}: database ${JSON.stringify(slug)}, mirror ${JSON.stringify(mirrored)}`,
      );
    }
  }
  assert.deepEqual(unexplained.slice(0, 10), []);
  assert.ok(
    versionGap < MAX_UNICODE_VERSION_GAP,
    `${versionGap} code points differ because the Unicode versions differ`,
  );
});
