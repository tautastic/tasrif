import assert from "node:assert/strict";
import { test } from "node:test";
import { openRepository } from "./repository-db.ts";

const { sql, entries } = await openRepository();

await sql.exec(
  `INSERT INTO lexical_entry (language, text, is_verified)
   SELECT 'ar', 'كلمة' || n, n % 5 <> 0 FROM generate_series(1, 23) AS n`,
);
const verifiedIds = await sql.column<number>(
  "SELECT id FROM lexical_entry WHERE is_verified ORDER BY created_at DESC, id DESC",
);

test("entries created in one statement share a timestamp", async () => {
  const distinct = await sql.scalar<number>("SELECT count(DISTINCT created_at)::int FROM lexical_entry");
  assert.equal(distinct, 1);
});

test("paging a language listing neither repeats nor skips entries that share a timestamp", async () => {
  const pageSize = 4;
  const seen: number[] = [];
  for (let page = 1; page <= 6; page++) {
    const { items, total } = await entries.getLexicalEntriesByLanguage({ language: "ar", page, limit: pageSize });
    assert.equal(total, verifiedIds.length);
    seen.push(...items.map((entry) => entry.id));
  }
  assert.deepEqual(seen, verifiedIds);
});

test("recent entries are newest first with the id as tiebreaker", async () => {
  const recent = await entries.getRecentLexicalEntries(7);
  assert.deepEqual(
    recent.map((entry) => entry.id),
    verifiedIds.slice(0, 7),
  );
});

test("random entries are distinct, verified and capped at the limit", async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const random = await entries.getRandomLexicalEntries(6);
    const randomIds = random.map((entry) => entry.id);
    assert.equal(randomIds.length, 6);
    assert.equal(new Set(randomIds).size, 6);
    assert.ok(randomIds.every((id) => verifiedIds.includes(id)));
  }
});

test("random entries return every verified entry once when the limit exceeds the table", async () => {
  const random = await entries.getRandomLexicalEntries(500);
  assert.deepEqual(
    random.map((entry) => entry.id).sort((a, b) => a - b),
    [...verifiedIds].sort((a, b) => a - b),
  );
});
