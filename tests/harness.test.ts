import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  assertSqlState,
  conjugate,
  findPattern,
  insertEntry,
  listPatterns,
  normalize,
  openDatabase,
  storedParadigm,
} from "./harness";

const db = await openDatabase();

test("the template database carries the seeded reference data", async () => {
  const patterns = await listPatterns(db);
  assert.ok(patterns.length >= 27, `expected at least 27 morph patterns, found ${patterns.length}`);
  const affixRules = await db.scalar<string>("SELECT count(*)::text FROM affix_rules");
  assert.ok(Number(affixRules) > 0);
});

test("normalization and conjugation run against the loaded functions", async () => {
  assertArabicEqual(await normalize(db, "كَتَبْـتُ"), "كَتَبْتُ");
  const pattern = await findPattern(db, 1, "a ~ u");
  const paradigm = await conjugate(db, "كتب", pattern.id);
  assertArabicEqual(paradigm.perfect?.third_person_masculine_singular ?? null, "كَتَبَ");
  assertArabicEqual(paradigm.imperative?.second_person_masculine_singular ?? null, "اُكْتُبْ");
});

test("writes are rolled back between tests", async () => {
  const pattern = await findPattern(db, 1, "a ~ u");
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: pattern.id });
    const paradigm = await storedParadigm(tx, entryId);
    assert.equal(Object.keys(paradigm).length, 5);
  });
  const remaining = await db.scalar<string>("SELECT count(*)::text FROM lexical_entry");
  assert.equal(remaining, "0");
});

test("SQL failures are captured with their SQLSTATE", async () => {
  const failure = await db.failure("SELECT classify_root($1)", ["كتاب"]);
  assertSqlState(failure, "22023", /exactly 3 radicals/);
});
