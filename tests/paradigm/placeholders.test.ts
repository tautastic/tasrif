import assert from "node:assert/strict";
import { test } from "node:test";
import { assertArabicEqual, openDatabase } from "../harness";

const db = await openDatabase();

const replace = (template: string, c1: string, c2: string, c3: string): Promise<string> =>
  db.scalar<string>("SELECT replace_root_placeholders($1, $2, $3, $4)", [template, c1, c2, c3]);

const buildPersonForms = (
  mood: string,
  template: unknown,
  formNumber: number,
  useAffix: boolean,
  c1: string,
  c2: string,
  c3: string,
): Promise<Record<string, string>> =>
  db.scalar<Record<string, string>>(
    "SELECT build_person_forms($1::affix_mood, $2::jsonb, $3::integer, $4::boolean, $5, $6, $7)",
    [mood, JSON.stringify(template), formNumber, useAffix, c1, c2, c3],
  );

test("replace_root_placeholders fills all three radical slots", async () => {
  assertArabicEqual(await replace("{1}َ{2}ْ{3}", "ك", "ت", "ب"), "كَتْب");
  assertArabicEqual(await replace("مَ{1}ْ{2}ُو{3}", "ك", "ت", "ب"), "مَكْتُوب");
});

test("replace_root_placeholders substitutes a repeated slot everywhere it occurs", async () => {
  assertArabicEqual(await replace("{1}{1}{1}", "ك", "ت", "ب"), "ككك");
  assertArabicEqual(await replace("{2}{1}{2}{3}{2}", "ك", "ت", "ب"), "تكتبت");
});

test("replace_root_placeholders leaves templates without placeholders untouched", async () => {
  assertArabicEqual(await replace("اِسْتَفْعَلَ", "ك", "ت", "ب"), "اِسْتَفْعَلَ");
  assert.equal(await replace("plain ascii", "ك", "ت", "ب"), "plain ascii");
});

test("replace_root_placeholders only recognises the three numbered slots", async () => {
  assert.equal(await replace("{0}{4}{11}{a}", "ك", "ت", "ب"), "{0}{4}{11}{a}");
});

test("replace_root_placeholders accepts empty radicals", async () => {
  assert.equal(await replace("{1}{2}{3}", "", "", ""), "");
  assertArabicEqual(await replace("{1}َ{2}ْ{3}", "ك", "", "ب"), "كَْب");
});

test("replace_root_placeholders accepts multi-character radicals", async () => {
  assertArabicEqual(await replace("{1}{2}{3}", "كا", "ت", "ب"), "كاتب");
  assertArabicEqual(await replace("{1}ْ{2}", "ال", "ك", "ب"), "الْك");
});

test("build_person_forms appends the affix suffix to a string template when use_affix is false", async () => {
  const forms = await buildPersonForms("perfect", "{1}َ{2}َ{3}", 0, false, "ك", "ت", "ب");
  assert.equal(Object.keys(forms).length, 13);
  assertArabicEqual(forms.third_person_masculine_singular ?? null, "كَتَبَ");
  assertArabicEqual(forms.first_person_singular ?? null, "كَتَبْتُ");
  assertArabicEqual(forms.third_person_masculine_plural ?? null, "كَتَبُوا");
  assertArabicEqual(forms.second_person_feminine_plural ?? null, "كَتَبْتُنَّ");
});

test("build_person_forms leaves an object template unsuffixed when use_affix is false", async () => {
  const forms = await buildPersonForms(
    "perfect",
    {
      third_person_masculine_singular: "{1}َا{3}َ",
      first_person_singular: "{1}ُ{3}ْتُ",
      third_person_masculine_plural: "{1}َا{3}ُوا",
    },
    0,
    false,
    "ق",
    "و",
    "ل",
  );
  assertArabicEqual(forms.third_person_masculine_singular ?? null, "قَالَ");
  assertArabicEqual(forms.first_person_singular ?? null, "قُلْتُ");
  assertArabicEqual(forms.third_person_masculine_plural ?? null, "قَالُوا");
});

test("build_person_forms skips persons absent from an object template", async () => {
  const forms = await buildPersonForms(
    "perfect",
    { third_person_masculine_singular: "{1}َا{3}َ", first_person_singular: "{1}ُ{3}ْتُ" },
    0,
    false,
    "ق",
    "و",
    "ل",
  );
  assert.deepEqual(Object.keys(forms).sort(), ["first_person_singular", "third_person_masculine_singular"]);
});

test("build_person_forms wraps a string template in prefix and suffix when use_affix is true", async () => {
  const forms = await buildPersonForms("imperfect_indicative", "{1}ْ{2}ُ{3}", 1, true, "ك", "ت", "ب");
  assert.equal(Object.keys(forms).length, 13);
  assertArabicEqual(forms.third_person_masculine_singular ?? null, "يَكْتُبُ");
  assertArabicEqual(forms.first_person_singular ?? null, "أَكْتُبُ");
  assertArabicEqual(forms.second_person_feminine_singular ?? null, "تَكْتُبِينَ");
  assertArabicEqual(forms.third_person_feminine_plural ?? null, "يَكْتُبْنَ");
});

test("build_person_forms wraps an object template in prefix and suffix when use_affix is true", async () => {
  const forms = await buildPersonForms(
    "imperfect_indicative",
    { third_person_masculine_singular: "{1}ُ{2}{3}", third_person_feminine_plural: "{1}ُ{3}" },
    1,
    true,
    "ق",
    "و",
    "ل",
  );
  assertArabicEqual(forms.third_person_masculine_singular ?? null, "يَقُولُ");
  assertArabicEqual(forms.third_person_feminine_plural ?? null, "يَقُلْنَ");
});

test("build_person_forms normalizes the assembled form", async () => {
  const forms = await buildPersonForms("perfect", "{1}ُوْ{2}", 0, false, "ق", "ل", "ب");
  assertArabicEqual(forms.third_person_masculine_singular ?? null, "قُولَ");

  const withTatweel = await buildPersonForms("perfect", "{1}َـ{2}َ{3}", 0, false, "ك", "ت", "ب");
  assertArabicEqual(withTatweel.third_person_masculine_singular ?? null, "كَتَبَ");
});

test("build_person_forms returns an empty object when no affix rules match the mood and form", async () => {
  const forms = await buildPersonForms("perfect", "{1}َ{2}َ{3}", 5, false, "ك", "ت", "ب");
  assert.deepEqual(forms, {});
});

test("build_person_forms produces exactly the five imperative persons", async () => {
  const forms = await buildPersonForms("imperative", "اُ{1}ْ{2}ُ{3}", 0, false, "ك", "ت", "ب");
  assert.deepEqual(Object.keys(forms).sort(), [
    "second_person_dual",
    "second_person_feminine_plural",
    "second_person_feminine_singular",
    "second_person_masculine_plural",
    "second_person_masculine_singular",
  ]);
  assertArabicEqual(forms.second_person_masculine_singular ?? null, "اُكْتُبْ");
  assertArabicEqual(forms.second_person_feminine_singular ?? null, "اُكْتُبِي");
});
