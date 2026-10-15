import assert from "node:assert/strict";
import { test } from "node:test";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";

const { sql, entries, senses } = await openRepository();

const add = async (input: Parameters<typeof insertEntryWithSense>[1]) =>
  (await insertEntryWithSense(sql, input)).entryId;

const ids = {
  kitab: await add({ language: "ar", text: "كِتَاب", root: "كتب" }),
  kuttab: await add({ language: "ar", text: "كُتَّاب", root: "كتب" }),
  kataba: await add({ language: "ar", text: "كَتَبَ", root: "كتب", pos: "verb" }),
  maktab: await add({ language: "ar", text: "مَكْتَب", root: "كتب" }),
  qalam: await add({ language: "ar", text: "قَلَم", root: "قلم" }),
  kitaba: await add({ language: "ar", text: "كِتَابَة", root: "كتب", isVerified: false }),
  book: await add({ language: "en", text: "book" }),
  running: await add({ language: "en", text: "running" }),
  bookmark: await add({ language: "en", text: "bookmark", isVerified: false }),
};

await sql.exec(
  `UPDATE lexical_entry
   SET search_vector = CASE
     WHEN language = 'ar' THEN to_tsvector('arabic', text || ' ' || normalized_text)
     ELSE to_tsvector('english', text || ' ' || normalized_text)
   END`,
);

const search = async (query: string, limit = 10, offset?: number) =>
  (await entries.searchLexicalEntries(query, limit, offset)).map((e) => e.id);

test("one and two character queries match by prefix of the normalized text, shortest first", async () => {
  const expected = [ids.kataba, ids.kitab, ids.kuttab];
  assert.deepEqual(await search("ك"), expected);
  assert.deepEqual(await search("كت"), expected);
  assert.deepEqual(await search("كِ"), expected);
});

test("prefix matching ignores case, skips unverified entries and does not match inside words", async () => {
  assert.deepEqual(await search("b"), [ids.book]);
  assert.deepEqual(await search("BO"), [ids.book]);
  assert.deepEqual(await search("م"), [ids.maktab]);
  assert.deepEqual(await search("ت"), []);
});

test("queries that normalise to nothing match nothing", async () => {
  for (const query of ["", "  ", "!", "%", "_", "ً", "- -"]) {
    assert.deepEqual(await search(query), [], JSON.stringify(query));
  }
});

test("longer Arabic queries rank the exact normalized text first and never return unverified entries", async () => {
  const found = await search("كتاب");
  assert.deepEqual(found.slice(0, 2), [ids.kitab, ids.kuttab]);
  assert.equal(found.includes(ids.kitaba), false);
  assert.equal(found.includes(ids.qalam), false);
  assert.deepEqual((await search("كَتَبَ"))[0], ids.kataba);
});

test("Arabic-script queries use the arabic configuration and others the english one", async () => {
  assert.deepEqual(await search("running"), [ids.running]);
  assert.deepEqual(await search("runs"), [ids.running]);
  assert.deepEqual(await search("run"), [ids.running]);
});

test("longer queries tolerate typos and partially typed words", async () => {
  assert.deepEqual(await search("bok"), [ids.book]);
  assert.deepEqual(await search("boo"), [ids.book]);
  assert.deepEqual((await search("كتا")).slice(0, 2), [ids.kitab, ids.kuttab]);
});

test("the result limit is applied", async () => {
  assert.equal((await search("ك", 2)).length, 2);
  assert.equal((await search("كتاب", 1)).length, 1);
});

test("an offset skips the first results of a prefix search and of a fuzzy search", async () => {
  for (const query of ["ك", "كتاب"]) {
    const all = await search(query);
    assert.ok(all.length >= 2, query);
    for (let offset = 0; offset <= all.length; offset += 1) {
      assert.deepEqual(await search(query, 2, offset), all.slice(offset, offset + 2), `${query} from ${offset}`);
    }
    assert.deepEqual(await search(query, 5, all.length + 3), [], query);
  }
});

test("a search without an offset starts at the first result", async () => {
  assert.deepEqual(await search("ك", 10, 0), await search("ك", 10));
  assert.deepEqual(await search("كتاب", 10, 0), await search("كتاب", 10));
});

test("sense search picks the text search configuration from the language or the script", async () => {
  const labels = async (params: Parameters<typeof senses.searchSenses>[0]) =>
    (await senses.searchSenses(params)).items.map((item) => item.text);

  assert.deepEqual(await labels({ query: "run", language: "en" }), ["running"]);
  assert.deepEqual(await labels({ query: "run" }), ["running"]);
  assert.deepEqual(await labels({ query: "كَتَبَ", language: "ar" }), ["كَتَبَ"]);
  assert.deepEqual(await labels({ query: "كَتَبَ" }), ["كَتَبَ"]);
  assert.deepEqual(await labels({ query: "كتاب", language: "en" }), []);
});
