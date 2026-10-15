import assert from "node:assert/strict";
import { test } from "node:test";
import { type Db, findPatternByCode, insertEntry, openDatabase } from "../harness";

const db = await openDatabase();
const soundFormI = await findPatternByCode(db, "f1-a-u");

interface DerivedStatus {
  has_pattern: boolean;
  has_verbal_nouns: boolean;
  conjugation_count: number;
  needs_attention: boolean;
}

const statusOf = (scope: Db, entryId: number): Promise<DerivedStatus> =>
  scope.one<DerivedStatus>(
    `SELECT has_pattern, has_verbal_nouns, conjugation_count, needs_attention
     FROM lexical_entry_derived_status WHERE lexical_entry_id = $1`,
    [entryId],
  );

test("an entry whose pattern generated its forms needs no attention", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const generated = Number(
      await tx.scalar<string>("SELECT count(*)::text FROM conjugation WHERE lexical_entry_id = $1", [entryId]),
    );
    assert.ok(generated > 0);
    assert.deepEqual(await statusOf(tx, entryId), {
      has_pattern: true,
      has_verbal_nouns: true,
      conjugation_count: generated,
      needs_attention: false,
    });
  });
});

test("an entry with a pattern but no root needs attention", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: null, morphPatternId: soundFormI.id });
    assert.deepEqual(await statusOf(tx, entryId), {
      has_pattern: true,
      has_verbal_nouns: false,
      conjugation_count: 0,
      needs_attention: true,
    });
  });
});

test("a legacy entry with a pattern and a four-letter root needs attention", async () => {
  await db.tx(async (tx) => {
    await tx.exec("ALTER TABLE lexical_entry DISABLE TRIGGER trg_normalize_lexical_entry_root");
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم", morphPatternId: soundFormI.id });
    await tx.exec("ALTER TABLE lexical_entry ENABLE TRIGGER trg_normalize_lexical_entry_root");
    await tx.exec("SELECT regenerate_all_derived_stems()");
    assert.deepEqual(await statusOf(tx, entryId), {
      has_pattern: true,
      has_verbal_nouns: false,
      conjugation_count: 0,
      needs_attention: true,
    });
  });
});

test("entries without a pattern never need attention, whatever their language", async () => {
  await db.tx(async (tx) => {
    const arabic = await insertEntry(tx, { text: "كِتَاب", root: "كتب" });
    const english = await insertEntry(tx, { language: "en", text: "book" });
    for (const entryId of [arabic, english]) {
      assert.deepEqual(await statusOf(tx, entryId), {
        has_pattern: false,
        has_verbal_nouns: false,
        conjugation_count: 0,
        needs_attention: false,
      });
    }
  });
});

test("the view has one row per entry", async () => {
  await db.tx(async (tx) => {
    await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    await insertEntry(tx, { language: "en", text: "write" });
    assert.equal(
      await tx.scalar<string>("SELECT count(*)::text FROM lexical_entry_derived_status"),
      await tx.scalar<string>("SELECT count(*)::text FROM lexical_entry"),
    );
  });
});
