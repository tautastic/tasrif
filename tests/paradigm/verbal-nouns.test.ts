import assert from "node:assert/strict";
import { test } from "node:test";
import { PARADIGM_FIXTURES } from "../fixtures/paradigms.ts";
import { assertArabicEqual, findPattern, openDatabase, verbalNouns } from "../harness";

const db = await openDatabase();

const patternIdFor = async (formNumber: number, description: string): Promise<number> =>
  (await findPattern(db, formNumber, description)).id;

for (const fixture of PARADIGM_FIXTURES) {
  test(`verbal nouns of ${fixture.id} (${fixture.citationForm}, ${fixture.gloss})`, async () => {
    const patternId = await patternIdFor(fixture.formNumber, fixture.description);
    const nouns = await verbalNouns(db, fixture.root, patternId);
    const deviations = fixture.engineDeviations ?? {};
    assertArabicEqual(nouns.masdar, deviations.masdar ?? fixture.masdar, `${fixture.id} masdar\n${fixture.source}`);
    assertArabicEqual(
      nouns.active_participle,
      deviations.active_participle ?? fixture.activeParticiple,
      `${fixture.id} active participle\n${fixture.source}`,
    );
    assertArabicEqual(
      nouns.passive_participle,
      deviations.passive_participle ?? fixture.passiveParticiple,
      `${fixture.id} passive participle\n${fixture.source}`,
    );
  });
}

test("masdar_override replaces only the masdar", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, { masdar_override: "كِتَابَة" });
  assertArabicEqual(nouns.masdar, "كِتَابَة");
  assertArabicEqual(nouns.active_participle, "كَاتِب");
  assertArabicEqual(nouns.passive_participle, "مَكْتُوب");
});

test("active_participle_override replaces only the active participle", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, { active_participle_override: "كُتَّاب" });
  assertArabicEqual(nouns.masdar, "كَتْب");
  assertArabicEqual(nouns.active_participle, "كُتَّاب");
  assertArabicEqual(nouns.passive_participle, "مَكْتُوب");
});

test("passive_participle_override replaces only the passive participle", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, { passive_participle_override: "مَكْتُوبَة" });
  assertArabicEqual(nouns.masdar, "كَتْب");
  assertArabicEqual(nouns.active_participle, "كَاتِب");
  assertArabicEqual(nouns.passive_participle, "مَكْتُوبَة");
});

test("all three overrides apply together", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, {
    masdar_override: "كِتَابَة",
    active_participle_override: "كُتَّاب",
    passive_participle_override: "مَكْتُوبَة",
  });
  assertArabicEqual(nouns.masdar, "كِتَابَة");
  assertArabicEqual(nouns.active_participle, "كُتَّاب");
  assertArabicEqual(nouns.passive_participle, "مَكْتُوبَة");
});

test("p_no_passive suppresses the passive participle and leaves the rest intact", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, {}, true);
  assertArabicEqual(nouns.masdar, "كَتْب");
  assertArabicEqual(nouns.active_participle, "كَاتِب");
  assert.equal(nouns.passive_participle, null);
});

test("p_no_passive wins over an explicit passive_participle_override", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, { passive_participle_override: "مَكْتُوبَة" }, true);
  assert.equal(nouns.passive_participle, null);
});

test("a pattern whose rules omit passive_participle yields NULL for it", async () => {
  const patternId = await patternIdFor(9, "");
  const hasKey = await db.scalar<boolean>("SELECT rules ? 'passive_participle' FROM morph_pattern WHERE id = $1", [
    patternId,
  ]);
  assert.equal(hasKey, false);
  const nouns = await verbalNouns(db, "حمر", patternId);
  assert.equal(nouns.passive_participle, null);
  assert.notEqual(nouns.masdar, null);
  assert.notEqual(nouns.active_participle, null);
});

test("overrides bypass placeholder replacement", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, { masdar_override: "{1}َ{2}ْ{3}" });
  assert.equal(nouns.masdar, "{1}َ{2}ْ{3}");
});

test("overrides are still normalized", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, {
    masdar_override: "كِتَاـبَة",
    active_participle_override: "كَاتِبْب",
  });
  assertArabicEqual(nouns.masdar, "كِتَابَة");
  assertArabicEqual(nouns.active_participle, "كَاتِبّ");
});

test("an unrelated override key changes nothing", async () => {
  const patternId = await patternIdFor(1, "a ~ u");
  const nouns = await verbalNouns(db, "كتب", patternId, { dual_form: "كِتَابَانِ" });
  assertArabicEqual(nouns.masdar, "كَتْب");
  assertArabicEqual(nouns.active_participle, "كَاتِب");
  assertArabicEqual(nouns.passive_participle, "مَكْتُوب");
});

test("every masdar template is vocalised", async () => {
  const patternId = await patternIdFor(1, "a ~ u, hollow waw");
  const template = await db.scalar<string>("SELECT rules->>'masdar' FROM morph_pattern WHERE id = $1", [patternId]);
  assert.equal(template, "{1}\u064E{2}\u0652{3}");

  const nouns = await verbalNouns(db, "قول", patternId);
  assertArabicEqual(nouns.masdar, "قَوْل");

  const bareTemplates = await db.column<string>(
    "SELECT form_number || ' ' || description FROM morph_pattern WHERE rules->>'masdar' !~ '[\\u064B-\\u0652]'",
  );
  assert.deepEqual(bareTemplates, [], "a masdar template with no vowel marks is a data slip, not a design choice");
});
