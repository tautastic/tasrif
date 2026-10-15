import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSIMILATION_FIXTURES } from "../fixtures/assimilation.ts";
import {
  assertArabicEqual,
  conjugate,
  findPattern,
  insertEntry,
  MOODS,
  type Mood,
  openDatabase,
  type Paradigm,
  PERSONS,
  type Person,
  storedParadigm,
  storedStems,
  verbalNouns,
} from "../harness";

const db = await openDatabase();

const SUKUN = "ْ";
const TEH = "ت";
const EMPHATIC_FIRST_RADICALS = ["ص", "ض", "ط", "ظ"];
const ASSIMILATING_FIRST_RADICALS = ["ص", "ض", "ط", "ظ", "ز", "د", "ذ", "ث"];
const SECOND_AND_THIRD_RADICALS = ["كب", "لم", "رس", "فع", "نق"];

const cell = (paradigm: Paradigm, mood: Mood, person: Person): string | null => paradigm[mood]?.[person] ?? null;

for (const fixture of ASSIMILATION_FIXTURES) {
  const heading = `${fixture.id} (${fixture.citationForm}, ${fixture.gloss})`;

  test(`form VIII assimilation: perfect, imperative and imperfect of ${heading}`, async () => {
    const pattern = await findPattern(db, 8, fixture.description);
    const paradigm = await conjugate(db, fixture.root, pattern.id);
    const context = `${heading}\n${fixture.source}`;

    assertArabicEqual(
      cell(paradigm, "perfect", "third_person_masculine_singular"),
      fixture.perfectThirdMasculineSingular,
      `${context}\nperfect 3ms`,
    );
    assertArabicEqual(
      cell(paradigm, "perfect", "first_person_singular"),
      fixture.perfectFirstSingular,
      `${context}\nperfect 1s`,
    );
    assertArabicEqual(
      cell(paradigm, "imperative", "second_person_masculine_singular"),
      fixture.imperativeSecondMasculineSingular,
      `${context}\nimperative 2ms`,
    );
    assertArabicEqual(
      cell(paradigm, "imperfect_indicative", "third_person_masculine_singular"),
      fixture.imperfectThirdMasculineSingular,
      `${context}\nimperfect indicative 3ms`,
    );
  });

  test(`form VIII assimilation: masdar and participles of ${heading}`, async () => {
    const pattern = await findPattern(db, 8, fixture.description);
    const nouns = await verbalNouns(db, fixture.root, pattern.id);
    const context = `${heading}\n${fixture.source}`;

    assertArabicEqual(nouns.masdar, fixture.masdar, `${context}\nmasdar`);
    assertArabicEqual(nouns.active_participle, fixture.activeParticiple, `${context}\nactive participle`);
    assertArabicEqual(nouns.passive_participle, fixture.passiveParticiple, `${context}\npassive participle`);
  });
}

test("form VIII assimilation reaches stored entries, not only the generators", async () => {
  await db.tx(async (tx) => {
    const pattern = await findPattern(tx, 8, "");
    const entryId = await insertEntry(tx, { text: "اِصْطَبَرَ", root: "صبر", morphPatternId: pattern.id });

    const paradigm = await storedParadigm(tx, entryId);
    const stems = await storedStems(tx, entryId);

    assertArabicEqual(cell(paradigm, "perfect", "third_person_masculine_singular"), "اِصْطَبَرَ", "stored perfect 3ms");
    assertArabicEqual(
      cell(paradigm, "imperfect_jussive", "third_person_masculine_singular"),
      "يَصْطَبِرْ",
      "stored jussive 3ms",
    );
    assertArabicEqual(stems.masdar, "اِصْطِبَار", "stored masdar");
    assertArabicEqual(stems.active_participle, "مُصْطَبِر", "stored active participle");
    assertArabicEqual(stems.passive_participle, "مُصْطَبَر", "stored passive participle");
  });
});

test("form VIII assimilation reaches the pattern preview, which feeds literal rules to the generators", async () => {
  const pattern = await findPattern(db, 8, "");
  const rows = await db.rows<{ mood: string; person: string; form: string }>(
    `SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
     FROM morph_pattern mp,
          LATERAL generate_conjugation_rows($1, mp.rules, 8, '{}'::jsonb, false) cr,
          LATERAL jsonb_each_text(cr.person_forms) kv
     WHERE mp.id = $2 AND cr.mood = 'perfect' AND kv.key = 'third_person_masculine_singular'`,
    ["ضرب", pattern.id],
  );
  assert.equal(rows.length, 1);
  assertArabicEqual(rows[0]?.form ?? null, "اِضْطَرَبَ", "preview perfect 3ms");

  const nouns = await db.one<{ masdar: string }>(
    `SELECT vn.masdar FROM morph_pattern mp, LATERAL generate_verbal_nouns($1, mp.rules, 8) vn WHERE mp.id = $2`,
    ["ضرب", pattern.id],
  );
  assertArabicEqual(nouns.masdar, "اِضْطِرَاب", "preview masdar");
});

test("form VIII leaves roots whose first radical does not assimilate untouched", async () => {
  const pattern = await findPattern(db, 8, "");
  const paradigm = await conjugate(db, "كتب", pattern.id);
  assertArabicEqual(cell(paradigm, "perfect", "third_person_masculine_singular"), "اِكْتَتَبَ");
  assertArabicEqual(cell(paradigm, "imperfect_indicative", "third_person_masculine_singular"), "يَكْتَتِبُ");

  const farq = await conjugate(db, "فرق", pattern.id);
  assertArabicEqual(cell(farq, "perfect", "third_person_masculine_singular"), "اِفْتَرَقَ");
});

test("no form VIII cell keeps an unassimilated infix after an assimilating first radical", async () => {
  const pattern = await findPattern(db, 8, "");
  const offenders: string[] = [];
  for (const first of ASSIMILATING_FIRST_RADICALS) {
    for (const rest of SECOND_AND_THIRD_RADICALS) {
      const root = `${first}${rest}`;
      const paradigm = await conjugate(db, root, pattern.id);
      const nouns = await verbalNouns(db, root, pattern.id);
      const forms = [
        ...MOODS.flatMap((mood) => PERSONS.map((person) => cell(paradigm, mood, person))),
        nouns.masdar,
        nouns.active_participle,
        nouns.passive_participle,
      ];
      for (const form of forms) {
        if (form?.includes(`${first}${SUKUN}${TEH}`)) {
          offenders.push(`${root}: ${form}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("an emphatic first radical always yields an emphatic infix or a geminate emphatic", async () => {
  const pattern = await findPattern(db, 8, "");
  for (const first of EMPHATIC_FIRST_RADICALS) {
    for (const rest of SECOND_AND_THIRD_RADICALS) {
      const paradigm = await conjugate(db, `${first}${rest}`, pattern.id);
      const perfect = cell(paradigm, "perfect", "third_person_masculine_singular") ?? "";
      assert.ok(perfect.includes(`${first}${SUKUN}ط`) || perfect.includes("طَّ"), `${first}${rest}: ${perfect}`);
    }
  }
});

test("the assimilation rewrites the infix only for form VIII", async () => {
  const rules = JSON.stringify({ perfect: "اِ{1}ْتَ{2}َ{3}َ", masdar: "اِ{1}ْتِ{2}َا{3}" });
  const asFormOne = await db.one<{ masdar: string }>("SELECT masdar FROM generate_verbal_nouns($1, $2::jsonb, 1) vn", [
    "صبر",
    rules,
  ]);
  assertArabicEqual(asFormOne.masdar, "اِصْتِبَار", "form I keeps the literal template");

  const asFormEight = await db.one<{ masdar: string }>(
    "SELECT masdar FROM generate_verbal_nouns($1, $2::jsonb, 8) vn",
    ["صبر", rules],
  );
  assertArabicEqual(asFormEight.masdar, "اِصْطِبَار", "form VIII assimilates the same template");
});

test("assimilate_form_viii_infix leaves rules without the infix sequence alone", async () => {
  const rules = JSON.stringify({ perfect: "{1}َ{2}َ{3}َ", imperative: "اُ{1}ْ{2}ُ{3}" });
  const rewritten = await db.scalar<string>("SELECT assimilate_form_viii_infix($1::jsonb, $2)::text", [rules, "ص"]);
  assert.deepEqual(JSON.parse(rewritten), JSON.parse(rules));
});
