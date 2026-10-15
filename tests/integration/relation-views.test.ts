import assert from "node:assert/strict";
import { test } from "node:test";
import { type Db, insertEntry, openDatabase } from "../harness";

const db = await openDatabase();

const insertSense = (scope: Db, entryId: number, pos: string, senseNumber = 1): Promise<number> =>
  scope.scalar<number>(
    "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, $2::pos_type, $3, ARRAY['x']) RETURNING id",
    [entryId, pos, senseNumber],
  );

const translationTargets = (scope: Db, senseId: number): Promise<{ target_sense_id: number; target_text: string }[]> =>
  scope.rows(
    "SELECT target_sense_id, target_text FROM sense_translation_normalized WHERE sense_id = $1 ORDER BY target_sense_id",
    [senseId],
  );

const relationTargets = (
  scope: Db,
  senseId: number,
): Promise<{ target_sense_id: number; relation_type: string; strength: number | null }[]> =>
  scope.rows(
    `SELECT target_sense_id, relation_type::text AS relation_type, strength
     FROM sense_relation_normalized WHERE sense_id = $1 ORDER BY target_sense_id, relation_type`,
    [senseId],
  );

test("two translations whose normalized text collides are both visible from the english sense", async () => {
  await db.tx(async (tx) => {
    const book = await insertSense(tx, await insertEntry(tx, { language: "en", text: "book" }), "noun");
    const kitab = await insertSense(tx, await insertEntry(tx, { text: "كِتَاب" }), "noun");
    const kuttab = await insertSense(tx, await insertEntry(tx, { text: "كُتَّاب" }), "noun");
    assert.equal(
      await tx.scalar<number>("SELECT count(DISTINCT normalized_text)::int FROM lexical_entry WHERE language = 'ar'"),
      1,
      "the two arabic entries share one normalized_text",
    );
    await tx.exec("INSERT INTO translation_link (en_sense_id, ar_sense_id) VALUES ($1, $2), ($1, $3)", [
      book,
      kitab,
      kuttab,
    ]);

    assert.deepEqual(
      (await translationTargets(tx, book)).map((row) => row.target_sense_id),
      [kitab, kuttab].sort((left, right) => left - right),
    );
    assert.deepEqual(
      (await translationTargets(tx, kitab)).map((row) => row.target_sense_id),
      [book],
    );
    assert.deepEqual(
      (await translationTargets(tx, kuttab)).map((row) => row.target_sense_id),
      [book],
    );
  });
});

test("the translation view reports exactly one row per stored link", async () => {
  await db.tx(async (tx) => {
    const book = await insertSense(tx, await insertEntry(tx, { language: "en", text: "book" }), "noun");
    const arabicSenses: number[] = [];
    for (const text of ["كِتَاب", "كُتَّاب", "كَتَّاب"]) {
      arabicSenses.push(await insertSense(tx, await insertEntry(tx, { text }), "noun"));
    }
    for (const arabic of arabicSenses) {
      await tx.exec("INSERT INTO translation_link (en_sense_id, ar_sense_id) VALUES ($1, $2)", [book, arabic]);
    }

    const stored = await tx.scalar<string>("SELECT count(*)::text FROM translation_link");
    const visible = await tx.scalar<string>(
      "SELECT count(*)::text FROM sense_translation_normalized WHERE sense_id = $1",
      [book],
    );
    assert.equal(visible, stored);
  });
});

test("the translation view keeps ordering by normalized text, then rank", async () => {
  await db.tx(async (tx) => {
    const word = await insertSense(tx, await insertEntry(tx, { language: "en", text: "word" }), "noun");
    const targets: number[] = [];
    for (const text of ["كلمة", "لفظ", "قول"]) {
      targets.push(await insertSense(tx, await insertEntry(tx, { text }), "noun"));
    }
    for (const target of targets) {
      await tx.exec("INSERT INTO translation_link (en_sense_id, ar_sense_id, frequency_rank) VALUES ($1, $2, 5)", [
        word,
        target,
      ]);
    }

    const ordered = await tx.column<string>(
      "SELECT target_normalized_text FROM sense_translation_normalized WHERE sense_id = $1",
      [word],
    );
    assert.deepEqual(ordered, [...ordered].sort());
  });
});

test("a relation stored in both directions is reported once per direction and type", async () => {
  await db.tx(async (tx) => {
    const first = await insertSense(tx, await insertEntry(tx, { language: "en", text: "big" }), "adjective");
    const second = await insertSense(tx, await insertEntry(tx, { language: "en", text: "large" }), "adjective");
    await tx.exec(
      `INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type, strength)
       VALUES ($1, $2, 'synonym', 5), ($2, $1, 'synonym', 7)`,
      [first, second],
    );

    const seenFromFirst = await relationTargets(tx, first);
    assert.equal(seenFromFirst.length, 1);
    assert.equal(seenFromFirst[0]?.target_sense_id, second);
    assert.equal(seenFromFirst[0]?.strength, 7, "the stronger duplicate wins deterministically");
    assert.equal((await relationTargets(tx, second)).length, 1);
  });
});

test("two relations to different senses with the same normalized text are both visible", async () => {
  await db.tx(async (tx) => {
    const origin = await insertSense(tx, await insertEntry(tx, { text: "كَتَبَ" }), "verb");
    const kitab = await insertSense(tx, await insertEntry(tx, { text: "كِتَاب" }), "noun");
    const kuttab = await insertSense(tx, await insertEntry(tx, { text: "كُتَّاب" }), "noun");
    await tx.exec(
      `INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type)
       VALUES ($1, $2, 'near_synonym'), ($1, $3, 'near_synonym')`,
      [origin, kitab, kuttab],
    );

    assert.deepEqual(
      (await relationTargets(tx, origin)).map((row) => row.target_sense_id),
      [kitab, kuttab].sort((left, right) => left - right),
    );
  });
});

test("different relation types between the same two senses stay separate rows", async () => {
  await db.tx(async (tx) => {
    const first = await insertSense(tx, await insertEntry(tx, { language: "en", text: "big" }), "adjective");
    const second = await insertSense(tx, await insertEntry(tx, { language: "en", text: "large" }), "adjective");
    await tx.exec(
      `INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type)
       VALUES ($1, $2, 'synonym'), ($1, $2, 'near_synonym')`,
      [first, second],
    );

    assert.deepEqual(
      (await relationTargets(tx, first)).map((row) => row.relation_type),
      ["near_synonym", "synonym"],
    );
  });
});

test("hyponym and hypernym are inverted when the relation is read from the other side", async () => {
  await db.tx(async (tx) => {
    const animal = await insertSense(tx, await insertEntry(tx, { language: "en", text: "animal" }), "noun");
    const cat = await insertSense(tx, await insertEntry(tx, { language: "en", text: "cat" }), "noun");
    await tx.exec("INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type) VALUES ($1, $2, 'hyponym')", [
      animal,
      cat,
    ]);

    assert.deepEqual(
      (await relationTargets(tx, animal)).map((row) => row.relation_type),
      ["hyponym"],
    );
    assert.deepEqual(
      (await relationTargets(tx, cat)).map((row) => row.relation_type),
      ["hypernym"],
    );
  });
});

test("the views keep the column names and types the repository code relies on", async () => {
  const columns = await db.rows<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN ('sense_translation_normalized', 'sense_relation_normalized')
     ORDER BY table_name, ordinal_position`,
  );
  assert.deepEqual(
    columns.map((column) => `${column.table_name}.${column.column_name}:${column.data_type}`),
    [
      "sense_relation_normalized.sense_id:integer",
      "sense_relation_normalized.target_sense_id:integer",
      "sense_relation_normalized.target_text:character varying",
      "sense_relation_normalized.target_normalized_text:text",
      "sense_relation_normalized.relation_type:USER-DEFINED",
      "sense_relation_normalized.context_note:text",
      "sense_relation_normalized.strength:smallint",
      "sense_relation_normalized.target_slug:text",
      "sense_translation_normalized.sense_id:integer",
      "sense_translation_normalized.target_sense_id:integer",
      "sense_translation_normalized.target_text:character varying",
      "sense_translation_normalized.target_normalized_text:text",
      "sense_translation_normalized.domain:character varying",
      "sense_translation_normalized.note:text",
      "sense_translation_normalized.frequency_rank:smallint",
      "sense_translation_normalized.target_slug:text",
    ],
  );
});
