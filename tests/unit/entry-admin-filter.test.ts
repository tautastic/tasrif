import assert from "node:assert/strict";
import { test } from "node:test";
import { openRepository } from "./repository-db.ts";

const { sql, entries, patterns } = await openRepository();

const pattern = await patterns.resolveVerbMorphPattern("كتب", "form-1-a-u");
assert.ok(pattern);

const insertVerb = (text: string, root: string, isVerified: boolean) =>
  sql.scalar<number>(
    "INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified) VALUES ('ar', $1, $2, $3, $4) RETURNING id",
    [text, root, pattern.id, isVerified],
  );

const leaveWithoutDerivedForms = async (entryId: number, root: string) => {
  await sql.exec(
    "ALTER TABLE lexical_entry DISABLE TRIGGER trg_normalize_lexical_entry_root, DISABLE TRIGGER trg_update_lexical_entry_derived_stems",
  );
  try {
    await sql.exec("UPDATE lexical_entry SET root = $2 WHERE id = $1", [entryId, root]);
    await sql.exec(
      "UPDATE lexical_entry SET masdar = NULL, active_participle = NULL, passive_participle = NULL WHERE id = $1",
      [entryId],
    );
    await sql.exec("DELETE FROM conjugation WHERE lexical_entry_id = $1", [entryId]);
  } finally {
    await sql.exec(
      "ALTER TABLE lexical_entry ENABLE TRIGGER trg_normalize_lexical_entry_root, ENABLE TRIGGER trg_update_lexical_entry_derived_stems",
    );
  }
};

const healthyVerified = await insertVerb("كَتَبَ", "كتب", true);
const healthyUnverified = await insertVerb("كَتَبَ ٢", "كتب", false);
const plainNoun = await sql.scalar<number>(
  "INSERT INTO lexical_entry (language, text, root, is_verified) VALUES ('ar', 'كِتَاب', 'كتب', true) RETURNING id",
);
const englishWord = await sql.scalar<number>(
  "INSERT INTO lexical_entry (language, text, is_verified) VALUES ('en', 'book', true) RETURNING id",
);
const onlyConjugationsMissing = await insertVerb("كَتَبَ ٣", "كتب", true);
await sql.exec("DELETE FROM conjugation WHERE lexical_entry_id = $1", [onlyConjugationsMissing]);

const legacyVerified = await insertVerb("تَرْجَمَ", "كتب", true);
await leaveWithoutDerivedForms(legacyVerified, "ترجم");
const legacyUnverified = await insertVerb("دَحْرَجَ", "كتب", false);
await leaveWithoutDerivedForms(legacyUnverified, "دحرج");

const MANY = 13;
const bulkIds: number[] = [];
for (let i = 0; i < MANY; i++) {
  const id = await insertVerb(`عَيِّنَة ${i}`, "كتب", i % 2 === 0);
  await leaveWithoutDerivedForms(id, "فعلل");
  bulkIds.push(id);
}

const attentionIds = [legacyVerified, legacyUnverified, ...bulkIds];

const listAll = async (filter: "All" | "Verified" | "Unverified" | "Needs attention", limit: number) => {
  const seen: number[] = [];
  let total = 0;
  for (let page = 1; page <= 20; page++) {
    const result = await entries.getLexicalEntriesForAdmin({ filter, page, limit });
    total = result.total;
    seen.push(...result.items.map((item) => item.id));
    if (result.items.length === 0) {
      break;
    }
  }
  return { seen, total };
};

test("the fixture really left the legacy entries with a pattern and nothing derived", async () => {
  for (const id of attentionIds) {
    const row = await sql.one<{ morph_pattern_id: number | null; masdar: string | null; forms: number }>(
      "SELECT morph_pattern_id, masdar, (SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = lexical_entry.id) AS forms FROM lexical_entry WHERE id = $1",
      [id],
    );
    assert.equal(row.morph_pattern_id, pattern.id);
    assert.equal(row.masdar, null);
    assert.equal(row.forms, 0);
  }
  const healthy = await sql.one<{ masdar: string | null; forms: number }>(
    "SELECT masdar, (SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = lexical_entry.id) AS forms FROM lexical_entry WHERE id = $1",
    [healthyVerified],
  );
  assert.ok(healthy.masdar);
  assert.ok(healthy.forms > 0);
});

test("entries with a pattern and no derived forms are listed and healthy ones are not", async () => {
  const { seen, total } = await listAll("Needs attention", 50);
  assert.equal(total, attentionIds.length);
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [...attentionIds].sort((a, b) => a - b),
  );
  for (const excluded of [healthyVerified, healthyUnverified, plainNoun, englishWord, onlyConjugationsMissing]) {
    assert.equal(seen.includes(excluded), false, `entry ${excluded} must not need attention`);
  }
});

test("the needs-attention count matches the listing", async () => {
  assert.equal(await entries.getNeedsAttentionCount(), attentionIds.length);
});

test("the needs-attention listing pages without repeats or gaps and reports the same total on every page", async () => {
  const limit = 4;
  const seen: number[] = [];
  const totals = new Set<number>();
  for (let page = 1; page <= Math.ceil(attentionIds.length / limit); page++) {
    const result = await entries.getLexicalEntriesForAdmin({ filter: "Needs attention", page, limit });
    totals.add(result.total);
    assert.ok(result.items.length <= limit);
    seen.push(...result.items.map((item) => item.id));
  }
  assert.deepEqual([...totals], [attentionIds.length]);
  assert.equal(new Set(seen).size, seen.length);
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [...attentionIds].sort((a, b) => a - b),
  );
  const beyond = await entries.getLexicalEntriesForAdmin({ filter: "Needs attention", page: 99, limit });
  assert.deepEqual(beyond.items, []);
  assert.equal(beyond.total, attentionIds.length);
});

test("the unverified filter keeps working with pagination next to the new filter", async () => {
  const expected = await sql.column<number>(
    "SELECT id FROM lexical_entry WHERE NOT is_verified ORDER BY created_at DESC, id",
  );
  assert.ok(expected.length > 5);
  const limit = 3;
  const { seen, total } = await listAll("Unverified", limit);
  assert.equal(total, expected.length);
  assert.deepEqual(seen, expected);

  const verified = await listAll("Verified", limit);
  const verifiedExpected = await sql.column<number>(
    "SELECT id FROM lexical_entry WHERE is_verified ORDER BY created_at DESC, id",
  );
  assert.equal(verified.total, verifiedExpected.length);
  assert.deepEqual(verified.seen, verifiedExpected);

  const all = await listAll("All", limit);
  assert.equal(all.total, expected.length + verifiedExpected.length);
});

test("repairing a flagged entry removes it from the list", async () => {
  await sql.exec("UPDATE lexical_entry SET root = 'كتب' WHERE id = $1", [legacyVerified]);
  const { seen, total } = await listAll("Needs attention", 50);
  assert.equal(total, attentionIds.length - 1);
  assert.equal(seen.includes(legacyVerified), false);
  assert.equal(await entries.getNeedsAttentionCount(), attentionIds.length - 1);
});
