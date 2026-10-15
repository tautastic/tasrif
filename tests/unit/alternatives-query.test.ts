import assert from "node:assert/strict";
import { test } from "node:test";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";

const { sql, entries } = await openRepository();
const { db } = await import("~/server/db");

const countQueries = async <T>(run: () => Promise<T>): Promise<{ result: T; queries: number }> => {
  const client = db.$client;
  const original = client.query.bind(client) as (...args: unknown[]) => unknown;
  let queries = 0;
  (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
    queries += 1;
    return original(...args);
  };
  try {
    const result = await run();
    return { result, queries };
  } finally {
    (client as unknown as { query: (...args: unknown[]) => unknown }).query = original;
  }
};

const patternId = (code: string) => sql.scalar<number>("SELECT id FROM morph_pattern WHERE code = $1", [code]);

const addVerb = async (text: string, root: string, code: string) => {
  const { entryId } = await insertEntryWithSense(sql, { language: "ar", text, root, pos: "verb" });
  await sql.exec("UPDATE lexical_entry SET morph_pattern_id = $1 WHERE id = $2", [await patternId(code), entryId]);
  return entryId;
};

const geminate = await addVerb("مَدَّ", "مدد", "f1-a-u-geminate");
const sound = await addVerb("كَتَبَ", "كتب", "f1-a-u");
const noun = (await insertEntryWithSense(sql, { language: "ar", text: "كِتَاب", root: "كتب" })).entryId;
const english = (await insertEntryWithSense(sql, { language: "en", text: "to extend" })).entryId;
void noun;
void english;

test("an entry with a geminate pattern carries its alternatives by mood and person", async () => {
  const page = await entries.getLexicalEntryBySlug("مد");
  assert.ok(page);
  const entry = page.entries.find((candidate) => candidate.id === geminate);
  assert.ok(entry?.alternatives);
  assert.deepEqual(entry.alternatives.imperfect_jussive?.third_person_masculine_singular, ["يَمُدِّ", "يَمْدُدْ"]);
  assert.deepEqual(entry.alternatives.imperative?.second_person_masculine_singular, ["مُدَّ", "مُدِّ"]);
  assert.deepEqual(Object.keys(entry.alternatives).sort(), ["imperative", "imperfect_jussive"]);
  assert.deepEqual(Object.keys(entry.alternatives.imperfect_jussive ?? {}).length, 5);
  assert.deepEqual(Object.keys(entry.passiveAlternatives ?? {}), ["imperfect_jussive"]);
  assert.deepEqual(entry.passiveAlternatives?.imperfect_jussive?.third_person_masculine_singular, ["يُمَدِّ", "يُمْدَدْ"]);
  assert.deepEqual(Object.keys(entry.passiveAlternatives?.imperfect_jussive ?? {}).length, 5);
});

test("an entry without alternatives has no alternatives property", async () => {
  const page = await entries.getLexicalEntryBySlug("كتب");
  assert.ok(page);
  const verb = page.entries.find((candidate) => candidate.id === sound);
  assert.ok(verb);
  assert.equal("alternatives" in verb, false);
  assert.ok(page.entries.every((candidate) => !("alternatives" in candidate)));
  assert.ok(page.entries.every((candidate) => !("passiveAlternatives" in candidate)));
});

test("the number of queries does not depend on the alternatives or on the number of persons", async () => {
  const withAlternatives = await countQueries(() => entries.getLexicalEntryBySlug("مد"));
  const withoutAlternatives = await countQueries(() => entries.getLexicalEntryBySlug("كتب"));
  const englishOnly = await countQueries(() => entries.getLexicalEntryBySlug("to-extend"));
  assert.ok(withAlternatives.result);
  assert.equal(withAlternatives.queries, withoutAlternatives.queries);
  assert.equal(englishOnly.queries, 1, "a page without a pattern asks nothing about alternatives");
  assert.equal(
    withAlternatives.queries,
    3,
    "the entries, the root count and one query for every alternative on the page",
  );

  await sql.exec("DELETE FROM morph_pattern_alternative");
  const none = await countQueries(() => entries.getLexicalEntryBySlug("مد"));
  assert.equal(none.queries, withAlternatives.queries);
});

test("a page of several homographs asks for all their alternatives in one query", async () => {
  await sql.exec(
    "INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified) VALUES ('ar', 'مُدَّ', 'مدد', $1, TRUE)",
    [await patternId("f1-a-u-geminate")],
  );
  await sql.exec(
    "INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified) VALUES ('ar', 'مِدَّ', 'مدد', $1, TRUE)",
    [await patternId("f1-a-u-geminate")],
  );
  const one = await countQueries(() => entries.getLexicalEntryBySlug("مد"));
  assert.equal(one.result?.entries.length, 3);
  assert.equal(one.queries, 3);
});

test("an entry with a second verbal noun carries it beside its alternative forms in the same three queries", async () => {
  const reduplicated = await addVerb("زَلْزَلَ", "زلزل", "f1-a-i-quadriliteral");
  const plain = await addVerb("دَحْرَجَ", "دحرج", "f1-a-i-quadriliteral");
  const page = await countQueries(() => entries.getLexicalEntryBySlug("زلزل"));
  assert.ok(page.result);
  assert.equal(page.queries, 3);
  const entry = page.result.entries.find((candidate) => candidate.id === reduplicated);
  assert.deepEqual(entry?.alternativeNouns, { masdar: ["زِلْزَال"] });
  assert.equal("alternatives" in (entry ?? {}), false);

  const other = await entries.getLexicalEntryBySlug("دحرج");
  const verb = other?.entries.find((candidate) => candidate.id === plain);
  assert.ok(verb);
  assert.equal("alternativeNouns" in verb, false);
  assert.equal("alternatives" in verb, false);
});
