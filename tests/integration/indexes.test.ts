import assert from "node:assert/strict";
import { test } from "node:test";
import { type Db, insertEntry, openDatabase } from "../harness";

const db = await openDatabase();

const indexDefinition = (scope: Db, name: string): Promise<string | null> =>
  scope
    .maybeOne<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1", [
      name,
    ])
    .then((row) => row?.indexdef ?? null);

const plan = async (scope: Db, statement: string, params: string[]): Promise<string> =>
  (await scope.column<string>(`EXPLAIN ${statement}`, params)).join("\n");

test("the lookup indexes that the repository queries rely on exist with the documented definitions", async () => {
  const expectations: [string, RegExp][] = [
    ["idx_lexical_entry_slug", /USING btree \(slug\)$/],
    ["idx_entry_slug_redirect_entry", /ON public\.entry_slug_redirect USING btree \(lexical_entry_id\)$/],
    ["idx_lexical_entry_normalized_text", /USING btree \(normalized_text\)$/],
    ["idx_lexical_entry_normalized_text_prefix", /USING btree \(normalized_text text_pattern_ops\)$/],
    ["idx_lexical_entry_normalized_text_trgm", /USING gin \(normalized_text gin_trgm_ops\)$/],
    ["idx_sense_relation_sense_id_2", /ON public\.sense_relation USING btree \(sense_id_2\)$/],
    ["idx_translation_link_ar_sense_id", /ON public\.translation_link USING btree \(ar_sense_id\)$/],
  ];
  for (const [name, pattern] of expectations) {
    const definition = await indexDefinition(db, name);
    assert.ok(definition !== null, `${name} is missing`);
    assert.match(definition, pattern, name);
  }
});

test("the redundant single-column indexes are gone because a unique constraint already leads with the column", async () => {
  assert.equal(await indexDefinition(db, "idx_conjugation_entry"), null);
  assert.equal(await indexDefinition(db, "idx_form_number"), null);

  const leading = await db.column<string>(
    `SELECT c.conname FROM pg_constraint c
     WHERE c.contype = 'u' AND c.conname IN ('unique_conjugation_entry_voice_mood_person', 'unique_form_number_description')
       AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1])
           IN ('lexical_entry_id', 'form_number')
     ORDER BY 1`,
  );
  assert.deepEqual(leading, ["unique_conjugation_entry_voice_mood_person", "unique_form_number_description"]);
});

test("an exact normalized_text lookup, a prefix lookup and a trigram match can all use an index", async () => {
  await db.tx(async (tx) => {
    for (const text of ["كِتَاب", "كَتَبَ", "book", "to write"]) {
      await insertEntry(tx, { language: /^[a-z ]+$/.test(text) ? "en" : "ar", text });
    }
    await tx.exec("ANALYZE lexical_entry");
    await tx.exec("SET LOCAL enable_seqscan = off");

    assert.match(
      await plan(tx, "SELECT id FROM lexical_entry WHERE normalized_text = $1", ["كتاب"]),
      /idx_lexical_entry_normalized_text/,
    );
    assert.match(
      await plan(tx, "SELECT id FROM lexical_entry WHERE normalized_text LIKE $1", ["كت%"]),
      /idx_lexical_entry_normalized_text/,
    );
    assert.match(
      await plan(tx, "SELECT id FROM lexical_entry WHERE normalized_text % $1", ["كتاب"]),
      /idx_lexical_entry_normalized_text_trgm/,
    );
  });
});

test("the foreign key columns that views and cascades join on can use an index", async () => {
  await db.tx(async (tx) => {
    await tx.exec("SET LOCAL enable_seqscan = off");
    assert.match(
      await plan(tx, "SELECT id FROM sense_relation WHERE sense_id_2 = $1::int", ["1"]),
      /idx_sense_relation_sense_id_2/,
    );
    assert.match(
      await plan(tx, "SELECT id FROM translation_link WHERE ar_sense_id = $1::int", ["1"]),
      /idx_translation_link_ar_sense_id/,
    );
  });
});
