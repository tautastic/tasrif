import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../harness";

const db = await openDatabase();

const ATTESTED: [string, string, string][] = [
  ["يَسْءَلُ", "يَسْأَلُ", "own fatha after sukun, Wright §133"],
  ["مَسْءُول", "مَسْؤُول", "own damma after sukun, Wright §133"],
  ["مَسْءَلَة", "مَسْأَلَة", "own fatha after sukun"],
  ["سُءِلَ", "سُئِلَ", "own kasra after damma, Wright §131"],
  ["سَءِمَ", "سَئِمَ", "own kasra after fatha, Wright §131"],
  ["يَسْءَمُ", "يَسْأَمُ", "own fatha after sukun"],
  ["رَءْس", "رَأْس", "own sukun after fatha"],
  ["رَءُفَ", "رَؤُفَ", "own damma after fatha, the stronger vowel wins"],
  ["لَءُمَ", "لَؤُمَ", "own damma after fatha"],
  ["فُءَاد", "فُؤَاد", "own fatha after damma, the stronger vowel wins"],
  ["رُءُوس", "رُؤُوس", "own damma after damma"],
  ["سُءَال", "سُؤَال", "own fatha after damma"],
  ["يُءْمِنُ", "يُؤْمِنُ", "own sukun after damma"],
  ["مُءْمِن", "مُؤْمِن", "own sukun after damma"],
  ["يُقْرِءُونَ", "يُقْرِئُونَ", "own damma after kasra, kasra wins"],
  ["تَقْرَءِينَ", "تَقْرَئِينَ", "own kasra after fatha"],
  ["يَقْرَءُونَ", "يَقْرَؤُونَ", "own damma after fatha"],
  ["قَرَءُوا", "قَرَؤُوا", "own damma after fatha"],
  ["بَرِءَتْ", "بَرِئَتْ", "own fatha after kasra, kasra wins"],
  ["جَرُءَتْ", "جَرُؤَتْ", "own fatha after damma"],
  ["قَرَءَتْ", "قَرَأَتْ", "own fatha after fatha"],
  ["قَرَءْتُ", "قَرَأْتُ", "own sukun after fatha"],
  ["بَرِءْتُ", "بَرِئْتُ", "own sukun after kasra"],
  ["جِءْتُ", "جِئْتُ", "own sukun after kasra"],
  ["قَرَءَ", "قَرَأَ", "final after fatha"],
  ["يَقْرَءُ", "يَقْرَأُ", "final after fatha, the case vowel does not count"],
  ["لَمْ يَقْرَءْ", "لَمْ يَقْرَأْ", "final after fatha, sukun"],
  ["بَرِءَ", "بَرِئَ", "final after kasra"],
  ["يَبْرَءُ", "يَبْرَأُ", "final after fatha"],
  ["بَطُءَ", "بَطُؤَ", "final after damma"],
  ["يَبْطُءُ", "يَبْطُؤُ", "final after damma"],
  ["قَارِء", "قَارِئ", "final after kasra"],
  ["مُنْشِء", "مُنْشِئ", "final after kasra"],
  ["مَقْرُوء", "مَقْرُوء", "final after long u stays on the line"],
  ["جَاءَ", "جَاءَ", "after long a with fatha stays on the line"],
  ["شَاءَ", "شَاءَ", "after long a with fatha stays on the line"],
  ["تَسَاءَلَ", "تَسَاءَلَ", "after long a with fatha stays on the line, Wright §133"],
  ["تَسَاءُل", "تَسَاؤُل", "after long a with damma"],
  ["سَاءِل", "سَائِل", "after long a with kasra"],
  ["قِرَاءَة", "قِرَاءَة", "after long a with fatha"],
  ["مُرُوءَة", "مُرُوءَة", "after long u with fatha stays on the line"],
  ["سَوْءَة", "سَوْءَة", "after waw sukun with fatha stays on the line"],
  ["مَوْءِل", "مَوْئِل", "after waw sukun with kasra"],
  ["مَوْءُودَة", "مَوْءُودَة", "after waw sukun with damma stays on the line"],
  ["يَسُوءُونَ", "يَسُوءُونَ", "after long u with damma stays on the line"],
  ["يَسُوءِينَ", "يَسُوئِينَ", "after long u with kasra"],
  ["بَدْء", "بَدْء", "final after sukun"],
  ["جُزْء", "جُزْء", "final after sukun"],
  ["شَيْء", "شَيْء", "final after yeh sukun"],
  ["يَجِيءُ", "يَجِيءُ", "final after long i"],
  ["جِيء", "جِيء", "final after long i"],
  ["هَيْءَة", "هَيْئَة", "after yeh sukun, always on yeh"],
  ["خَطِيءَة", "خَطِيئَة", "after long i, always on yeh"],
  ["يَيْءَسُ", "يَيْئَسُ", "after yeh sukun, always on yeh"],
  ["اِنْءَ", "اِنْأَ", "final with its own fatha after sukun (jussive and imperative of نأى)"],
  ["يَنْءَ", "يَنْأَ", "final with its own fatha after sukun"],
  ["ءَكَلَ", "أَكَلَ", "initial with fatha"],
  ["ءُمِرَ", "أُمِرَ", "initial with damma"],
  ["ءِيمَان", "إِيمَان", "initial with kasra"],
  ["ءِذْن", "إِذْن", "initial with kasra"],
  ["يُءَكِّدُ", "يُؤَكِّدُ", "own fatha after damma, geminate"],
  ["رَءَّسَ", "رَأَّسَ", "geminated hamza with fatha after fatha"],
  ["يُرَءِّسُ", "يُرَئِّسُ", "geminated hamza with kasra after fatha"],
  ["يُهَنِّءُ", "يُهَنِّئُ", "final after a geminated consonant with kasra"],
  ["اِءْتَمَنَ", "اِئْتَمَنَ", "own sukun after kasra, hamza of wasl"],
  ["اُءْمُرْ", "اُؤْمُرْ", "own sukun after damma, hamza of wasl"],
  ["اِسْتَءْذَنَ", "اِسْتَأْذَنَ", "own sukun after fatha"],
  ["أَءْكُلُ", "أَأْكُلُ", "bare hamza after a seated one"],
  ["أُءْمِنُ", "أُؤْمِنُ", "own sukun after damma, before the merge into a long u"],
  ["إِءْمَان", "إِئْمَان", "own sukun after kasra, before the merge into a long i"],
];

const MERGED: [string, string][] = [
  ["أُءْمِنُ", "أُومِنُ"],
  ["أُءْكِلُ", "أُوكِلُ"],
  ["إِءْمَان", "إِيمَان"],
  ["إِءْكَال", "إِيكَال"],
  ["يُءْمِنُ", "يُؤْمِنُ"],
  ["أَءْكُلُ", "آكُلُ"],
  ["ءَاخَذَ", "آخَذَ"],
];

test("a bare hamza is seated as in attested spellings", async () => {
  const rows = await db.rows<{ input: string; seated: string }>(
    `SELECT input, normalize_arabic_hamza_seating_bare(input) AS seated
     FROM jsonb_array_elements_text($1::jsonb) AS inputs(input)`,
    [JSON.stringify(ATTESTED.map(([input]) => input))],
  );
  const seated = new Map(rows.map((row) => [row.input, row.seated]));
  const wrong = ATTESTED.filter(([input, expected]) => seated.get(input) !== expected).map(
    ([input, expected, rule]) => `${input}: ${seated.get(input)} instead of ${expected} (${rule})`,
  );
  assert.deepEqual(wrong, []);
});

test("an attested spelling is also what the whole orthography chain gives", async () => {
  const joined = ATTESTED.filter(
    ([input, expected]) =>
      !input.includes(" ") && !expected.includes("أَأْ") && !expected.includes("أُؤْ") && !expected.includes("إِئْ"),
  );
  const rows = await db.rows<{ input: string; normalised: string }>(
    `SELECT input, normalize_arabic_orthography(input) AS normalised
     FROM jsonb_array_elements_text($1::jsonb) AS inputs(input)`,
    [JSON.stringify(joined.map(([input]) => input))],
  );
  const normalised = new Map(rows.map((row) => [row.input, row.normalised]));
  const wrong = joined
    .filter(([input, expected]) => normalised.get(input) !== expected)
    .map(([input, expected]) => `${input}: ${normalised.get(input)} instead of ${expected}`);
  assert.deepEqual(wrong, []);
});

type Preceding =
  | "start"
  | "fatha"
  | "damma"
  | "kasra"
  | "sukun"
  | "yeh-sukun"
  | "waw-sukun"
  | "long-a"
  | "long-u"
  | "long-i";
type Own = "fatha" | "damma" | "kasra" | "none";

const BY_OWN = (fatha: string, damma: string, kasra: string, none: string): Record<Own, string> => ({
  fatha,
  damma,
  kasra,
  none,
});
const ALL = (seat: string): Record<Own, string> => BY_OWN(seat, seat, seat, seat);

const MEDIAL: Record<Preceding, Record<Own, string>> = {
  start: BY_OWN("أ", "أ", "إ", "أ"),
  fatha: BY_OWN("أ", "ؤ", "ئ", "أ"),
  damma: BY_OWN("ؤ", "ؤ", "ئ", "ؤ"),
  kasra: ALL("ئ"),
  sukun: BY_OWN("أ", "ؤ", "ئ", "ء"),
  "yeh-sukun": ALL("ئ"),
  "long-i": ALL("ئ"),
  "waw-sukun": BY_OWN("ء", "ء", "ئ", "ء"),
  "long-u": BY_OWN("ء", "ء", "ئ", "ء"),
  "long-a": BY_OWN("ء", "ؤ", "ئ", "ء"),
};

const FINAL: Record<Preceding, Record<Own, string>> = {
  start: BY_OWN("أ", "أ", "إ", "أ"),
  fatha: ALL("أ"),
  damma: ALL("ؤ"),
  kasra: ALL("ئ"),
  sukun: BY_OWN("أ", "ؤ", "ئ", "ء"),
  "yeh-sukun": ALL("ء"),
  "waw-sukun": ALL("ء"),
  "long-i": ALL("ء"),
  "long-u": ALL("ء"),
  "long-a": ALL("ء"),
};

const codepoints = (text: string): string =>
  [...text].map((character) => (character.codePointAt(0) ?? 0).toString(16)).join(" ");

const SHADDA = "ّ";
const LETTER = /^[ء-ي]/u;

const PRECEDING_RULES: [RegExp, Preceding][] = [
  [/\u064E$/u, "fatha"],
  [/\u064F$/u, "damma"],
  [/\u0650$/u, "kasra"],
  [/\u064A\u0652$/u, "yeh-sukun"],
  [/\u0648\u0652$/u, "waw-sukun"],
  [/\u0652$/u, "sukun"],
  [/[\u0627\u0622\u0649]$/u, "long-a"],
  [/\u0648$/u, "long-u"],
  [/\u064A$/u, "long-i"],
];

const precedingOf = (before: string): Preceding => {
  const text = before.endsWith(SHADDA) ? before.slice(0, -1) : before;
  if (text === "" || !/[\u0621-\u0652]$/u.test(text)) {
    return "start";
  }
  return PRECEDING_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "sukun";
};

const ownOf = (after: string): { own: Own; rest: string } => {
  const text = after.startsWith(SHADDA) ? after.slice(1) : after;
  const first = text[0];
  let own: Own = "none";
  let rest = text;
  if (first === "َ" || first === "ً") {
    own = "fatha";
    rest = text.slice(1);
  } else if (first === "ُ" || first === "ٌ") {
    own = "damma";
    rest = text.slice(1);
  } else if (first === "ِ" || first === "ٍ") {
    own = "kasra";
    rest = text.slice(1);
  } else if (first === "ْ") {
    rest = text.slice(1);
  }
  return { own, rest: rest.startsWith(SHADDA) ? rest.slice(1) : rest };
};

const oracle = (input: string): string => {
  let result = "";
  const characters = [...input];
  characters.forEach((character, index) => {
    if (character !== "ء") {
      result += character;
      return;
    }
    const before = characters.slice(0, index).join("");
    const after = characters.slice(index + 1).join("");
    const preceding = precedingOf(before);
    const { own, rest } = ownOf(after);
    const isFinal = !LETTER.test(rest);
    result += (isFinal ? FINAL : MEDIAL)[preceding][own];
  });
  return result;
};

const ALPHABETS: readonly (readonly string[])[] = [
  ["ء", "ء", "ء", "ء"],
  ["ب", "ت", "ك", "ل", "م", "ن", "ر", "س"],
  ["ا", "و", "ي", "ى", "آ"],
  ["َ", "ُ", "ِ", "ْ", "ّ"],
  ["ً", "ٌ", "ٍ"],
  ["أ", "ؤ", "ئ", "إ"],
  [" "],
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
    const length = 1 + Math.floor(random() * 10);
    return Array.from({ length }, () => pick(pick(ALPHABETS))).join("");
  });
};

test("a quiescent hamza after the hamza of a prefix becomes a long vowel of the prefix's vowel", async () => {
  const rows = await db.rows<{ input: string; normalised: string }>(
    `SELECT input, normalize_arabic_orthography(input) AS normalised
     FROM jsonb_array_elements_text($1::jsonb) AS inputs(input)`,
    [JSON.stringify(MERGED.map(([input]) => input))],
  );
  const normalised = new Map(rows.map((row) => [row.input, row.normalised]));
  const wrong = MERGED.filter(([input, expected]) => normalised.get(input) !== expected).map(
    ([input, expected]) => `${input}: ${normalised.get(input)} instead of ${expected}`,
  );
  assert.deepEqual(wrong, []);
});

test("the oracle written from the table of Wright's rules agrees with every attested spelling", () => {
  const wrong = ATTESTED.filter(([input, expected]) => oracle(input) !== expected).map(
    ([input, expected]) => `${input}: oracle ${oracle(input)} instead of ${expected}`,
  );
  assert.deepEqual(wrong, []);
});

test("the seat function agrees with an independent oracle on thousands of generated strings", async () => {
  const inputs = generate(20_000);
  assert.ok(inputs.filter((value) => value.includes("ء")).length > 10_000);
  const seated = (
    await db.rows<{ seated: string }>(
      `SELECT normalize_arabic_hamza_seating_bare(value) AS seated
       FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS input(value, position)
       ORDER BY position`,
      [JSON.stringify(inputs)],
    )
  ).map((row) => row.seated);
  const differences: string[] = [];
  inputs.forEach((input, index) => {
    const expected = oracle(input);
    if (seated[index] !== expected) {
      differences.push(
        `${codepoints(input)}: database ${codepoints(seated[index] ?? "")}, oracle ${codepoints(expected)}`,
      );
    }
  });
  assert.deepEqual(differences.slice(0, 10), []);
});

test("seating leaves a string without a bare hamza as it was, and seating twice changes nothing", async () => {
  const inputs = generate(5_000);
  const rows = await db.rows<{ input: string; once: string; twice: string }>(
    `SELECT value AS input,
            normalize_arabic_hamza_seating_bare(value) AS once,
            normalize_arabic_hamza_seating_bare(normalize_arabic_hamza_seating_bare(value)) AS twice
     FROM jsonb_array_elements_text($1::jsonb) AS input(value)`,
    [JSON.stringify(inputs)],
  );
  for (const row of rows) {
    if (!row.input.includes("ء")) {
      assert.equal(row.once, row.input);
    }
    assert.equal(row.twice.replaceAll("ء", ""), row.once.replaceAll("ء", ""));
  }
});

test("a hamza radical is a bare hamza whichever letter it was typed with", async () => {
  const typed = ["أ", "إ", "آ", "ؤ", "ئ", "ء"];
  for (const letter of typed) {
    assert.equal(await db.scalar<string>("SELECT canonical_hamza_root($1)", [`${letter}كل`]), "ءكل", letter);
    assert.equal(
      await db.scalar<string>("SELECT replace_root_placeholders('{1}{2}{3}', $1, 'ك', 'ل')", [letter]),
      "ءكل",
      letter,
    );
  }
  assert.equal(await db.scalar<string>("SELECT canonical_hamza_root('كتب')"), "كتب");
});
