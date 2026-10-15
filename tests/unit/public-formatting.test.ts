import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectScriptLanguage,
  entryPath,
  formatCount,
  formatLanguageName,
  formatMorphPatternFormNumber,
  formatPartOfSpeechType,
  formatRoot,
  formatSenseRelationType,
  rootPath,
} from "~/lib/formatting";

test("formatCount picks the singular only for exactly one", () => {
  assert.equal(formatCount(0, "entry", "entries"), "0 entries");
  assert.equal(formatCount(1, "entry", "entries"), "1 entry");
  assert.equal(formatCount(2, "entry", "entries"), "2 entries");
  assert.equal(formatCount(1, "form", "forms"), "1 form");
});

test("formatRoot separates the radicals with hyphens", () => {
  assert.equal(formatRoot("كتب"), "ك-ت-ب");
  assert.equal(formatRoot("ترجم"), "ت-ر-ج-م");
  assert.equal(formatRoot(""), "");
});

test("formatMorphPatternFormNumber uses Roman numerals up to XV and digits beyond", () => {
  assert.equal(formatMorphPatternFormNumber(1), "I");
  assert.equal(formatMorphPatternFormNumber(4), "IV");
  assert.equal(formatMorphPatternFormNumber(8), "VIII");
  assert.equal(formatMorphPatternFormNumber(10), "X");
  assert.equal(formatMorphPatternFormNumber(15), "XV");
  assert.equal(formatMorphPatternFormNumber(16), "16");
  assert.equal(formatMorphPatternFormNumber(0), "0");
});

test("label helpers cover every language, part of speech and relation", () => {
  assert.equal(formatLanguageName("ar"), "Arabic");
  assert.equal(formatLanguageName("en"), "English");
  assert.equal(formatPartOfSpeechType("noun"), "Noun");
  assert.equal(formatPartOfSpeechType("adverbial_phrase"), "Adverbial phrase");
  assert.equal(formatSenseRelationType("near_synonym"), "near synonym");
  assert.equal(formatSenseRelationType("hypernym"), "hypernym");
});

test("entryPath and rootPath percent-encode the slug", () => {
  assert.equal(entryPath("book"), "/entry/book");
  assert.equal(entryPath("كتاب"), "/entry/%D9%83%D8%AA%D8%A7%D8%A8");
  assert.equal(entryPath("a/b?c#d"), "/entry/a%2Fb%3Fc%23d");
  assert.equal(rootPath("كتب"), "/root/%D9%83%D8%AA%D8%A8");
  assert.equal(decodeURIComponent(entryPath("كتاب")), "/entry/كتاب");
});

test("detectScriptLanguage reports Arabic when any Arabic-script letter is present", () => {
  assert.equal(detectScriptLanguage("كتاب"), "ar");
  assert.equal(detectScriptLanguage("كَتَبَ"), "ar");
  assert.equal(detectScriptLanguage("book كتاب"), "ar");
  assert.equal(detectScriptLanguage("(كتاب)"), "ar");
  assert.equal(detectScriptLanguage("پ"), "ar");
});

test("detectScriptLanguage reports English for Latin text, digits, punctuation and empty input", () => {
  assert.equal(detectScriptLanguage("book"), "en");
  assert.equal(detectScriptLanguage("to write"), "en");
  assert.equal(detectScriptLanguage("1234 (5)"), "en");
  assert.equal(detectScriptLanguage("café"), "en");
  assert.equal(detectScriptLanguage(""), "en");
});
