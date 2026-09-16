import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOT_SAMPLES } from "../fixtures/roots.ts";
import { openDatabase } from "../harness";

const db = await openDatabase();

const char = (point: number) => String.fromCodePoint(point);

const TATWEEL = char(0x0640);
const FATHA = char(0x064e);
const DAMMA = char(0x064f);
const KASRA = char(0x0650);
const SHADDA = char(0x0651);
const SUKUN = char(0x0652);
const WAVY_HAMZA_BELOW = char(0x065f);
const SUPERSCRIPT_ALEF = char(0x0670);
const QURANIC_SAJDAH = char(0x06e9);
const ZWNJ = char(0x200c);
const ZWJ = char(0x200d);

const transliterate = (root: string | null): Promise<string | null> =>
  db.scalar<string | null>("SELECT transliterate_arabic_root($1)", [root]);

const ALPHABET: [string, string][] = [
  ["ا", "ʔ"],
  ["ب", "b"],
  ["ت", "t"],
  ["ث", "ṯ"],
  ["ج", "j"],
  ["ح", "ḥ"],
  ["خ", "ḵ"],
  ["د", "d"],
  ["ذ", "ḏ"],
  ["ر", "r"],
  ["ز", "z"],
  ["س", "s"],
  ["ش", "š"],
  ["ص", "ṣ"],
  ["ض", "ḍ"],
  ["ط", "ṭ"],
  ["ظ", "ẓ"],
  ["ع", "ʕ"],
  ["غ", "ḡ"],
  ["ف", "f"],
  ["ق", "q"],
  ["ك", "k"],
  ["ل", "l"],
  ["م", "m"],
  ["ن", "n"],
  ["ه", "h"],
  ["و", "w"],
  ["ي", "y"],
  ["ء", "ʔ"],
  ["أ", "ʔ"],
  ["إ", "ʔ"],
  ["آ", "ʔ"],
  ["ؤ", "ʔ"],
  ["ئ", "ʔ"],
  ["ة", "h"],
  ["ى", "y"],
];

test("transliterate_arabic_root maps every letter in its alphabet", async () => {
  for (const [arabic, latin] of ALPHABET) {
    assert.equal(await transliterate(arabic), latin, `letter ${arabic}`);
  }
});

test("transliterate_arabic_root collapses every hamza carrier onto the glottal stop", async () => {
  for (const carrier of ["ء", "أ", "إ", "آ", "ؤ", "ئ"]) {
    assert.equal(await transliterate(carrier), "ʔ", `carrier ${carrier}`);
  }
});

test("transliterate_arabic_root also renders bare alef as a glottal stop", async () => {
  assert.equal(await transliterate("ا"), "ʔ");
});

test("transliterate_arabic_root maps teh marbuta to h and alef maksura to y", async () => {
  assert.equal(await transliterate("ة"), "h");
  assert.equal(await transliterate("ى"), "y");
});

test("transliterate_arabic_root produces the latin root recorded for every sampled root", async () => {
  for (const sample of ROOT_SAMPLES) {
    assert.equal(await transliterate(sample.root), sample.latin, `${sample.shape} (${sample.root})`);
  }
});

test("transliterate_arabic_root strips diacritics before mapping letters", async () => {
  const noisy: [string, string][] = [
    ["tatweel", `ك${TATWEEL}ت${TATWEEL}ب`],
    ["fatha", `ك${FATHA}ت${FATHA}ب`],
    ["damma", `ك${DAMMA}تب`],
    ["kasra", `ك${KASRA}تب`],
    ["shadda", `كت${SHADDA}ب`],
    ["sukun", `كتب${SUKUN}`],
    ["wavy hamza below", `ك${WAVY_HAMZA_BELOW}تب`],
    ["superscript alef", `ك${SUPERSCRIPT_ALEF}تب`],
    ["quranic annotation", `ك${QURANIC_SAJDAH}تب`],
  ];
  for (const [label, root] of noisy) {
    assert.equal(await transliterate(root), "ktb", label);
  }
});

test("transliterate_arabic_root trims surrounding spaces", async () => {
  assert.equal(await transliterate("  كتب  "), "ktb");
});

test("transliterate_arabic_root trims surrounding tabs", async () => {
  assert.equal(await transliterate("\tكتب\t"), "ktb");
});

test("transliterate_arabic_root returns NULL when nothing survives", async () => {
  assert.equal(await transliterate(""), null);
  assert.equal(await transliterate("   "), null);
  assert.equal(await transliterate(`${FATHA}${DAMMA}${KASRA}`), null);
  assert.equal(await transliterate(TATWEEL), null);
});

test("transliterate_arabic_root returns NULL for NULL input", async () => {
  assert.equal(await transliterate(null), null);
});

test("transliterate_arabic_root passes unmapped characters through unchanged", async () => {
  assert.equal(await transliterate("پتب"), "پtb");
  assert.equal(await transliterate("abc"), "abc");
  assert.equal(await transliterate(`${char(0xfefb)}تب`), `${char(0xfefb)}tb`);
});

test("transliterate_arabic_root discards exactly the separators classify_root discards", async () => {
  const separators: [string, string][] = [
    ["interior space", "ك ت ب"],
    ["hyphen", "ك-ت-ب"],
    ["zero width non-joiner", `ك${ZWNJ}تب`],
    ["zero width joiner", `ك${ZWJ}تب`],
  ];
  for (const [label, root] of separators) {
    assert.equal(await transliterate(root), "ktb", label);
    const classification = await db.one<{ radical1: string }>("SELECT (classify_root($1)).*", [root]);
    assert.equal(classification.radical1, "sound", `${label} still classifies as a sound root`);
  }
});
