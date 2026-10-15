import assert from "node:assert/strict";
import { test } from "node:test";
import { assertArabicEqual, conjugate, findPatternByCode, openDatabase, verbalNouns } from "../harness";

const db = await openDatabase();

const SOURCE =
  "Wright, A Grammar of the Arabic Language, vol. 1, verbs with a weak third radical: in the derived forms " +
  "waw and ya final radicals are inflected alike; Wiktionary conjugation tables of اِشْتَرَى and اِرْتَجَى; " +
  "the vendored appendix (Form X) states that defective roots inflect as -ā/-ī defectives without distinguishing them";

interface Expected {
  code: string;
  root: string;
  cells: [
    mood: "perfect" | "imperfect_indicative" | "imperfect_subjunctive" | "imperfect_jussive" | "imperative",
    person: string,
    form: string,
  ][];
  masdar: string;
  activeParticiple: string;
  passiveParticiple: string;
}

const EXPECTED: Expected[] = [
  {
    code: "f8-final-weak-ya",
    root: "شري",
    cells: [
      ["perfect", "third_person_masculine_singular", "اِشْتَرَى"],
      ["perfect", "third_person_feminine_singular", "اِشْتَرَتْ"],
      ["perfect", "first_person_singular", "اِشْتَرَيْتُ"],
      ["perfect", "third_person_masculine_plural", "اِشْتَرَوْا"],
      ["imperfect_indicative", "third_person_masculine_singular", "يَشْتَرِي"],
      ["imperfect_indicative", "third_person_masculine_plural", "يَشْتَرُونَ"],
      ["imperfect_subjunctive", "third_person_masculine_singular", "يَشْتَرِيَ"],
      ["imperfect_jussive", "third_person_masculine_singular", "يَشْتَرِ"],
      ["imperative", "second_person_masculine_singular", "اِشْتَرِ"],
    ],
    masdar: "اِشْتِرَاء",
    activeParticiple: "مُشْتَرٍ",
    passiveParticiple: "مُشْتَرًى",
  },
  {
    code: "f8-final-weak-waw",
    root: "رجو",
    cells: [
      ["perfect", "third_person_masculine_singular", "اِرْتَجَى"],
      ["perfect", "third_person_feminine_singular", "اِرْتَجَتْ"],
      ["perfect", "first_person_singular", "اِرْتَجَيْتُ"],
      ["perfect", "third_person_masculine_plural", "اِرْتَجَوْا"],
      ["imperfect_indicative", "third_person_masculine_singular", "يَرْتَجِي"],
      ["imperfect_indicative", "third_person_masculine_plural", "يَرْتَجُونَ"],
      ["imperfect_subjunctive", "third_person_masculine_singular", "يَرْتَجِيَ"],
      ["imperfect_jussive", "third_person_masculine_singular", "يَرْتَجِ"],
      ["imperative", "second_person_masculine_singular", "اِرْتَجِ"],
    ],
    masdar: "اِرْتِجَاء",
    activeParticiple: "مُرْتَجٍ",
    passiveParticiple: "مُرْتَجًى",
  },
];

for (const expected of EXPECTED) {
  test(`${expected.code} conjugates ${expected.root} as a Form VIII defective`, async () => {
    const pattern = await findPatternByCode(db, expected.code);
    const paradigm = await conjugate(db, expected.root, pattern.id);
    for (const [mood, person, form] of expected.cells) {
      const cells: Record<string, string | undefined> = paradigm[mood] ?? {};
      assertArabicEqual(cells[person] ?? null, form, `${expected.code} ${mood}/${person} (${SOURCE})`);
    }
    const nouns = await verbalNouns(db, expected.root, pattern.id);
    assertArabicEqual(nouns.masdar, expected.masdar, `${expected.code} masdar`);
    assertArabicEqual(nouns.active_participle, expected.activeParticiple, `${expected.code} active participle`);
    assertArabicEqual(nouns.passive_participle, expected.passiveParticiple, `${expected.code} passive participle`);
  });
}

test("the final-weak waw and ya patterns of forms IV, VIII and X carry identical templates", async () => {
  const rows = await db.rows<{ ya: string; waw: string; same: boolean }>(
    `SELECT ya.code AS ya, waw.code AS waw,
            ya.rules = waw.rules AND ya.no_affix = waw.no_affix AND ya.vocalic_template = waw.vocalic_template AS same
     FROM morph_pattern ya
     JOIN morph_pattern waw ON waw.code = 'f' || ya.form_number || '-final-weak-waw'
     WHERE ya.code IN ('f4-final-weak-ya', 'f8-final-weak-ya', 'f10-final-weak-ya')
     ORDER BY ya.form_number`,
  );
  assert.deepEqual(
    rows,
    [
      { ya: "f4-final-weak-ya", waw: "f4-final-weak-waw", same: true },
      { ya: "f8-final-weak-ya", waw: "f8-final-weak-waw", same: true },
      { ya: "f10-final-weak-ya", waw: "f10-final-weak-waw", same: true },
    ],
    "derived forms inflect waw and ya final radicals alike, so the two patterns must not drift apart",
  );
});
