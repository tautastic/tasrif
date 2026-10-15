import assert from "node:assert/strict";
import { test } from "node:test";
import { assertArabicEqual, findPatternByCode, insertEntry, openDatabase, storedStems } from "../harness";

const db = await openDatabase();
const soundFormI = await findPatternByCode(db, "f1-a-u");
const formVIII = await findPatternByCode(db, "f8");

const searchVector = (entryId: number): Promise<string> =>
  db.scalar<string>("SELECT search_vector::text FROM lexical_entry WHERE id = $1", [entryId]);

test("an active participle override replaces the stored participle and enters the search vector", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { active_participle_override: "كَتَّاب" },
    });
    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.active_participle, "كَتَّاب");
    assertArabicEqual(stems.masdar, "كَتْب");
    assertArabicEqual(stems.passive_participle, "مَكْتُوب");
    assert.match(await searchVector(entryId), /كتاب/);

    await tx.exec("UPDATE lexical_entry SET morphology_overrides = NULL WHERE id = $1", [entryId]);
    assertArabicEqual((await storedStems(tx, entryId)).active_participle, "كَاتِب", "clearing restores the template");
  });
});

test("a passive participle override replaces the stored participle unless no_passive is set", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { passive_participle_override: "مَكْتُوبَة" },
    });
    assertArabicEqual((await storedStems(tx, entryId)).passive_participle, "مَكْتُوبَة");

    await tx.exec(
      `UPDATE lexical_entry
       SET morphology_overrides = '{"passive_participle_override": "مَكْتُوبَة", "no_passive": true}'::jsonb
       WHERE id = $1`,
      [entryId],
    );
    assert.equal((await storedStems(tx, entryId)).passive_participle, null, "no_passive wins over the override");
  });
});

test("overrides are stored after orthographic normalization and are not assimilated", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "اِصْطَبَرَ",
      root: "صبر",
      morphPatternId: formVIII.id,
      overrides: { active_participle_override: "مُصْتَـبِر" },
    });
    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.active_participle, "مُصْتَبِر", "tatweel removed, infix left as written");
    assertArabicEqual(stems.passive_participle, "مُصْطَبَر", "the generated participle is assimilated");
  });
});

test("overrides survive regeneration triggered by a pattern update", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { active_participle_override: "كَتَّاب", passive_participle_override: "مَكْتُوبَة" },
    });
    await tx.exec(`UPDATE morph_pattern SET rules = rules || '{"masdar": "{1}ِ{2}َا{3}َة"}'::jsonb WHERE id = $1`, [
      soundFormI.id,
    ]);
    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.masdar, "كِتَابَة");
    assertArabicEqual(stems.active_participle, "كَتَّاب");
    assertArabicEqual(stems.passive_participle, "مَكْتُوبَة");
  });
});

test("an override only applies where the pattern has a template for that participle", async () => {
  await db.tx(async (tx) => {
    await tx.exec(`UPDATE morph_pattern SET rules = rules - 'active_participle' WHERE id = $1`, [soundFormI.id]);
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { active_participle_override: "كَتَّاب" },
    });
    assert.equal((await storedStems(tx, entryId)).active_participle, null);
  });
});

test("an empty override stores an empty participle", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { active_participle_override: "" },
    });
    assert.equal((await storedStems(tx, entryId)).active_participle, "");
  });
});
