import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  type Db,
  findPattern,
  IMPERATIVE_PERSONS,
  insertEntry,
  MOODS,
  openDatabase,
  PERSONS,
  storedParadigm,
  storedStems,
} from "../harness";

const db = await openDatabase();
const soundFormI = await findPattern(db, 1, "a ~ u");
const formII = await findPattern(db, 2, "");

const conjugationCount = (scope: Db, entryId: number): Promise<string> =>
  scope.scalar<string>("SELECT count(*)::text FROM conjugation WHERE lexical_entry_id = $1", [entryId]);

const searchVector = (scope: Db, entryId: number): Promise<string | null> =>
  scope.scalar<string | null>("SELECT search_vector::text FROM lexical_entry WHERE id = $1", [entryId]);

const latinRoot = (scope: Db, entryId: number): Promise<string | null> =>
  scope.scalar<string | null>("SELECT latin_root FROM lexical_entry WHERE id = $1", [entryId]);

test("inserting an entry with a root and a pattern builds the whole paradigm", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    const paradigm = await storedParadigm(tx, entryId);
    assert.deepEqual(Object.keys(paradigm).sort(), [...MOODS].sort());
    assert.deepEqual(Object.keys(paradigm.perfect ?? {}).sort(), [...PERSONS].sort());
    assert.deepEqual(Object.keys(paradigm.imperative ?? {}).sort(), [...IMPERATIVE_PERSONS].sort());
    for (const mood of ["imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"] as const) {
      assert.deepEqual(Object.keys(paradigm[mood] ?? {}).sort(), [...PERSONS].sort());
    }
    assert.equal(await conjugationCount(tx, entryId), "57");

    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.masdar, "كَتْب", "masdar");
    assertArabicEqual(stems.active_participle, "كَاتِب", "active participle");
    assertArabicEqual(stems.passive_participle, "مَكْتُوب", "passive participle");
    assert.notEqual(await searchVector(tx, entryId), null);
  });
});

test("INSERT RETURNING reports pre-trigger values because the stem trigger fires AFTER", async () => {
  await db.tx(async (tx) => {
    const returned = await tx.one<{ id: number; masdar: string | null; latin_root: string | null; sv: string | null }>(
      `INSERT INTO lexical_entry (language, text, root, morph_pattern_id)
       VALUES ('ar', $1, $2, $3)
       RETURNING id, masdar, latin_root, search_vector::text AS sv`,
      ["دَرَسَ", "درس", soundFormI.id],
    );

    assert.equal(returned.masdar, null);
    assert.equal(returned.sv, null);
    assert.equal(returned.latin_root, "drs");

    const settled = await storedStems(tx, returned.id);
    assertArabicEqual(settled.masdar, "دَرْس", "masdar after re-query");
    assert.notEqual(await searchVector(tx, returned.id), null);
  });
});

test("set_lexical_entry_latin_root maintains latin_root across the entry lifecycle", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    assert.equal(await latinRoot(tx, entryId), "ktb");

    await tx.exec("UPDATE lexical_entry SET root = $2 WHERE id = $1", [entryId, "درس"]);
    assert.equal(await latinRoot(tx, entryId), "drs");

    await tx.exec("UPDATE lexical_entry SET root = NULL WHERE id = $1", [entryId]);
    assert.equal(await latinRoot(tx, entryId), null);
  });
});

test("updating only text keeps the stems and still refreshes the search vector", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const before = await storedParadigm(tx, entryId);

    await tx.exec("UPDATE lexical_entry SET text = $2 WHERE id = $1", [entryId, "كَتَبَ ثانية"]);

    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.masdar, "كَتْب", "masdar survives a text-only update");
    assert.deepEqual(await storedParadigm(tx, entryId), before);
    assert.equal(
      await tx.scalar<boolean>(
        "SELECT search_vector @@ plainto_tsquery('arabic', $2) FROM lexical_entry WHERE id = $1",
        [entryId, "ثانية"],
      ),
      true,
    );
  });
});

test("changing the root regenerates the paradigm and the stems", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE lexical_entry SET root = $2 WHERE id = $1", [entryId, "درس"]);

    const paradigm = await storedParadigm(tx, entryId);
    assertArabicEqual(paradigm.perfect?.third_person_masculine_singular ?? null, "دَرَسَ", "perfect 3ms");
    assertArabicEqual((await storedStems(tx, entryId)).masdar, "دَرْس", "masdar");
    assert.equal(await conjugationCount(tx, entryId), "57");
  });
});

test("changing the pattern regenerates against the new templates", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = $2 WHERE id = $1", [entryId, formII.id]);

    assertArabicEqual((await storedStems(tx, entryId)).masdar, "تَكْتِيب", "form II masdar");
    const paradigm = await storedParadigm(tx, entryId);
    assertArabicEqual(paradigm.perfect?.third_person_masculine_singular ?? null, "كَتَّبَ", "form II perfect 3ms");
  });
});

test("morphology_overrides.no_passive suppresses the passive participle and is reversible", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { no_passive: true },
    });
    const suppressed = await storedStems(tx, entryId);
    assert.equal(suppressed.passive_participle, null);
    assertArabicEqual(suppressed.active_participle, "كَاتِب", "active participle is unaffected");

    await tx.exec("UPDATE lexical_entry SET morphology_overrides = '{}'::jsonb WHERE id = $1", [entryId]);
    assertArabicEqual((await storedStems(tx, entryId)).passive_participle, "مَكْتُوب", "passive participle returns");
  });
});

test("a masdar override replaces the generated masdar only", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { masdar_override: "كِتَابَة" },
    });
    const stems = await storedStems(tx, entryId);
    assertArabicEqual(stems.masdar, "كِتَابَة", "overridden masdar");
    assertArabicEqual(stems.active_participle, "كَاتِب", "active participle still generated");
  });
});

test("clearing morph_pattern_id wipes the stems and every conjugation", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = NULL WHERE id = $1", [entryId]);

    const stems = await storedStems(tx, entryId);
    assert.equal(stems.masdar, null);
    assert.equal(stems.active_participle, null);
    assert.equal(stems.passive_participle, null);
    assert.equal(await conjugationCount(tx, entryId), "0");
    assert.equal(stems.latin_root, "ktb");
  });
});

test("a root shorter than three characters wipes the derived data but keeps latin_root", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE lexical_entry SET root = $2 WHERE id = $1", [entryId, "كت"]);

    const stems = await storedStems(tx, entryId);
    assert.equal(stems.masdar, null);
    assert.equal(await conjugationCount(tx, entryId), "0");
    assert.equal(stems.latin_root, "kt");
  });
});

test("a root of exactly three characters is enough to generate", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    assert.equal(await conjugationCount(tx, entryId), "57");
  });
});

test("deleting the pattern nulls the reference and wipes the derived data", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("DELETE FROM morph_pattern WHERE id = $1", [soundFormI.id]);

    const row = await tx.one<{ morph_pattern_id: number | null; masdar: string | null }>(
      "SELECT morph_pattern_id, masdar FROM lexical_entry WHERE id = $1",
      [entryId],
    );
    assert.equal(row.morph_pattern_id, null);
    assert.equal(row.masdar, null);
    assert.equal(await conjugationCount(tx, entryId), "0");
  });
});

test("deleting an entry cascades its conjugations away", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    assert.equal(await conjugationCount(tx, entryId), "57");

    await tx.exec("DELETE FROM lexical_entry WHERE id = $1", [entryId]);

    assert.equal(await conjugationCount(tx, entryId), "0");
  });
});

test("an entry without a root or pattern is left with no derived data", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { language: "en", text: "to write" });
    const stems = await storedStems(tx, entryId);
    assert.equal(stems.masdar, null);
    assert.equal(stems.latin_root, null);
    assert.equal(await conjugationCount(tx, entryId), "0");
    assert.notEqual(await searchVector(tx, entryId), null);
  });
});
