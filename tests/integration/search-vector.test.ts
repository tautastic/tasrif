import assert from "node:assert/strict";
import { test } from "node:test";
import { type Db, findPattern, insertEntry, openDatabase, storedParadigm, storedStems } from "../harness";

const db = await openDatabase();
const soundFormI = await findPattern(db, 1, "a ~ u");
const formII = await findPattern(db, 2, "");

const matches = (scope: Db, entryId: number, query: string, config = "arabic"): Promise<boolean> =>
  scope.scalar<boolean>("SELECT search_vector @@ plainto_tsquery($3::regconfig, $2) FROM lexical_entry WHERE id = $1", [
    entryId,
    query,
    config,
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
         COALESCE((SELECT string_agg(c.form, ' ' ORDER BY c.id) FROM conjugation c WHERE c.lexical_entry_id = le.id), ''))
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

test("an english entry is indexed with the english configuration, so inflections find it", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { language: "en", text: "running" });

    assert.equal(await matches(tx, entryId, "run", "english"), true, "stemmed query matches");
    assert.equal(await matches(tx, entryId, "runs", "english"), true, "another inflection matches");
    assert.equal(await matches(tx, entryId, "walk", "english"), false);

    const rebuilt = await tx.scalar<boolean>(
      "SELECT search_vector = to_tsvector('english', text || ' ' || normalized_text) FROM lexical_entry WHERE id = $1",
      [entryId],
    );
    assert.equal(rebuilt, true);
    assert.equal((await vectorOf(tx, entryId))?.includes("'run'"), true, "the vector holds the stemmed lexeme");
  });
});

test("an arabic entry keeps the arabic configuration and ignores diacritics in the query", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كِتَاب" });

    assert.equal(await matches(tx, entryId, "كِتَاب", "arabic"), true);
    assert.equal(await matches(tx, entryId, "كتاب", "arabic"), true);
    assert.equal(
      await matches(tx, entryId, "كتاب", "english"),
      true,
      "english queries on Arabic script still match the tokens",
    );
  });
});

test("changing an entry's language rebuilds its vector on the next recalculation", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { language: "en", text: "running" });
    assert.equal(await matches(tx, entryId, "run", "english"), true);

    await tx.exec("UPDATE lexical_entry SET language = 'ar' WHERE id = $1", [entryId]);
    await tx.exec("SELECT recalculate_search_vector($1)", [entryId]);

    assert.equal(await matches(tx, entryId, "run", "english"), false);
    assert.equal(await matches(tx, entryId, "running", "arabic"), true);
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

test("sense context tags stay out of the search vector and are matched through their own index", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { language: "en", text: "court" });
    const senseId = await tx.scalar<number>(
      "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, 'noun', 1, '{}') RETURNING id",
      [entryId],
    );
    const before = await vectorOf(tx, entryId);

    await tx.exec("UPDATE sense SET context_tags = ARRAY['legal', 'royal'] WHERE id = $1", [senseId]);

    assert.equal(await vectorOf(tx, entryId), before);
    assert.equal(await matches(tx, entryId, "legal", "english"), false);
    assert.deepEqual(await tx.column<number>("SELECT id FROM sense WHERE context_tags @> ARRAY['legal']::text[]"), [
      senseId,
    ]);
    assert.equal(
      await tx.scalar<string>("SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_sense_context_tags'"),
      "CREATE INDEX idx_sense_context_tags ON public.sense USING gin (context_tags)",
    );
  });
});
