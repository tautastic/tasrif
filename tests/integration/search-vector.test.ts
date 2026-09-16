import assert from "node:assert/strict";
import { test } from "node:test";
import { type Db, findPattern, insertEntry, openDatabase, storedParadigm, storedStems } from "../harness";

const db = await openDatabase();
const soundFormI = await findPattern(db, 1, "a ~ u");
const formII = await findPattern(db, 2, "");

const matches = (scope: Db, entryId: number, query: string): Promise<boolean> =>
  scope.scalar<boolean>("SELECT search_vector @@ plainto_tsquery('arabic', $2) FROM lexical_entry WHERE id = $1", [
    entryId,
    query,
  ]);

const vectorOf = (scope: Db, entryId: number): Promise<string | null> =>
  scope.scalar<string | null>("SELECT search_vector::text FROM lexical_entry WHERE id = $1", [entryId]);

test("the search vector covers the text, the stems and every conjugated form", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const stems = await storedStems(tx, entryId);
    const paradigm = await storedParadigm(tx, entryId);

    assert.equal(await matches(tx, entryId, "كَتَبَ"), true, "entry text");
    assert.equal(await matches(tx, entryId, stems.masdar ?? ""), true, "masdar");
    assert.equal(await matches(tx, entryId, stems.active_participle ?? ""), true, "active participle");
    assert.equal(await matches(tx, entryId, stems.passive_participle ?? ""), true, "passive participle");
    assert.equal(
      await matches(tx, entryId, paradigm.imperative?.second_person_masculine_singular ?? ""),
      true,
      "imperative form",
    );
    assert.equal(
      await matches(tx, entryId, paradigm.imperfect_indicative?.first_person_plural ?? ""),
      true,
      "imperfect form",
    );
  });
});

test("the search vector is built with the arabic configuration over the documented concatenation", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    const rebuilt = await tx.scalar<boolean>(
      `SELECT le.search_vector = to_tsvector('arabic',
         le.text || ' ' || le.normalized_text || ' ' || COALESCE(le.masdar, '') || ' ' ||
         COALESCE(le.active_participle, '') || ' ' || COALESCE(le.passive_participle, '') || ' ' ||
         COALESCE((SELECT string_agg(c.form, ' ') FROM conjugation c WHERE c.lexical_entry_id = le.id), ''))
       FROM lexical_entry le WHERE le.id = $1`,
      [entryId],
    );
    assert.equal(rebuilt, true);

    const differsFromSimple = await tx.scalar<boolean>(
      "SELECT search_vector <> to_tsvector('simple', text) FROM lexical_entry WHERE id = $1",
      [entryId],
    );
    assert.equal(differsFromSimple, true);
  });
});

test("an entry with no stems and no conjugations still gets a vector", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { language: "en", text: "to write" });

    assert.notEqual(await vectorOf(tx, entryId), null);
    assert.equal(await matches(tx, entryId, "write"), true);
  });
});

test("a suppressed passive participle does not break the vector", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, {
      text: "كَتَبَ",
      root: "كتب",
      morphPatternId: soundFormI.id,
      overrides: { no_passive: true },
    });
    const stems = await storedStems(tx, entryId);

    assert.equal(stems.passive_participle, null);
    assert.equal(await matches(tx, entryId, stems.active_participle ?? ""), true);
    assert.equal(await matches(tx, entryId, "مَكْتُوب"), false, "the suppressed participle is not searchable");
  });
});

test("the vector is refreshed when the conjugations change", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    assert.equal(await matches(tx, entryId, "تَكْتِيب"), false, "form II masdar is absent before the switch");

    await tx.exec("UPDATE lexical_entry SET morph_pattern_id = $2 WHERE id = $1", [entryId, formII.id]);

    assert.equal(await matches(tx, entryId, "تَكْتِيب"), true, "form II masdar is searchable after the switch");
  });
});

test("recalculate_search_vector is idempotent", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const before = await vectorOf(tx, entryId);

    await tx.exec("SELECT recalculate_search_vector($1)", [entryId]);
    await tx.exec("SELECT recalculate_search_vector($1)", [entryId]);

    assert.equal(await vectorOf(tx, entryId), before);
  });
});
