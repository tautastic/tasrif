import assert from "node:assert/strict";
import { test } from "node:test";
import { entryEditSchema } from "../../src/components/admin/entry-edit-form/schema.ts";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";

const repo = await openRepository();
const { sql, entries, pgError } = repo;

interface TranslationRow {
  id: number;
  en_sense_id: number;
  ar_sense_id: number;
  frequency_rank: number;
  domain: string | null;
  note: string | null;
}

interface RelationRow {
  id: number;
  sense_id_1: number;
  sense_id_2: number;
  relation_type: string;
  strength: number | null;
  context_note: string | null;
  created_at: Date;
}

const translationRows = (senseIds: number[]) =>
  sql.rows<TranslationRow>(
    "SELECT id, en_sense_id, ar_sense_id, frequency_rank, domain, note FROM translation_link WHERE en_sense_id = ANY($1::int[]) OR ar_sense_id = ANY($1::int[]) ORDER BY id",
    [`{${senseIds.join(",")}}`],
  );

const relationRows = (senseIds: number[]) =>
  sql.rows<RelationRow>(
    "SELECT id, sense_id_1, sense_id_2, relation_type::text AS relation_type, strength, context_note, created_at FROM sense_relation WHERE sense_id_1 = ANY($1::int[]) OR sense_id_2 = ANY($1::int[]) ORDER BY id",
    [`{${senseIds.join(",")}}`],
  );

type EditableEntry = NonNullable<Awaited<ReturnType<typeof entries.getLexicalEntryForEdit>>>;

const loadForSave = async (entryId: number) => {
  const loaded = await entries.getLexicalEntryForEdit(entryId);
  assert.ok(loaded, "entry exists");
  return loaded;
};

const save = async (entry: EditableEntry) => {
  const parsed = entryEditSchema.safeParse({
    ...entry,
    verbFormChoice: null,
    morphologyOverrides: entry.morphologyOverrides ?? { no_passive: false },
  });
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  const { verbFormChoice: _verbFormChoice, ...persistable } = parsed.data;
  return entries.updateLexicalEntry({ ...persistable, morphPatternId: null });
};

const withSense = (entry: EditableEntry, changes: Partial<EditableEntry["senses"][number]>): EditableEntry => ({
  ...entry,
  senses: entry.senses.map((sense, index) => (index === 0 ? { ...sense, ...changes } : sense)),
});

test("a no-op save keeps every link, including targets that share a normalized text", async () => {
  const book = await insertEntryWithSense(sql, { language: "en", text: "book" });
  const kitab = await insertEntryWithSense(sql, { language: "ar", text: "كِتَاب", root: "كتب" });
  const kuttab = await insertEntryWithSense(sql, { language: "ar", text: "كُتَّاب", root: "كتب" });
  await sql.exec(
    "INSERT INTO translation_link (en_sense_id, ar_sense_id, frequency_rank, domain, note) VALUES ($1, $2, 5, 'general', NULL), ($1, $3, 2, 'lit', 'second book')",
    [book.senseId, kitab.senseId, kuttab.senseId],
  );
  const before = await translationRows([book.senseId]);
  assert.equal(before.length, 2);

  const loaded = await loadForSave(book.entryId);
  assert.deepEqual(
    loaded.senses[0]?.translations.map((translation) => translation.targetSenseId),
    [kitab.senseId, kuttab.senseId],
  );

  await save(loaded);

  assert.deepEqual(await translationRows([book.senseId]), before);
});

test("saving only changes the translation rows that differ", async () => {
  const word = await insertEntryWithSense(sql, { language: "en", text: "word" });
  const first = await insertEntryWithSense(sql, { language: "ar", text: "كَلِمَة", root: "كلم" });
  const second = await insertEntryWithSense(sql, { language: "ar", text: "لَفْظ", root: "لفظ" });
  const third = await insertEntryWithSense(sql, { language: "ar", text: "قَوْل", root: "قول" });
  await sql.exec(
    "INSERT INTO translation_link (en_sense_id, ar_sense_id, frequency_rank, domain) VALUES ($1, $2, 1, 'a'), ($1, $3, 2, 'b')",
    [word.senseId, first.senseId, second.senseId],
  );
  const [firstRow, secondRow] = await translationRows([word.senseId]);
  assert.ok(firstRow && secondRow);

  const loaded = await loadForSave(word.entryId);
  await save(
    withSense(loaded, {
      translations: [
        { targetSenseId: second.senseId, domain: "changed", note: null },
        { targetSenseId: third.senseId, domain: null, note: "new" },
      ],
    }),
  );

  const after = await translationRows([word.senseId]);
  assert.equal(after.length, 2);
  assert.deepEqual(after[0], { ...secondRow, domain: "changed" });
  assert.equal(after[1]?.ar_sense_id, third.senseId);
  assert.equal(after[1]?.note, "new");
  assert.equal(after[1]?.frequency_rank, 5);
});

test("an Arabic entry keeps and edits its links from the Arabic side", async () => {
  const english = await insertEntryWithSense(sql, { language: "en", text: "door" });
  const arabic = await insertEntryWithSense(sql, { language: "ar", text: "بَاب", root: "بوب" });
  await sql.exec("INSERT INTO translation_link (en_sense_id, ar_sense_id, frequency_rank) VALUES ($1, $2, 3)", [
    english.senseId,
    arabic.senseId,
  ]);
  const before = await translationRows([arabic.senseId]);

  const loaded = await loadForSave(arabic.entryId);
  assert.deepEqual(loaded.senses[0]?.translations, [{ targetSenseId: english.senseId, domain: null, note: null }]);
  await save(loaded);

  assert.deepEqual(await translationRows([arabic.senseId]), before);
});

test("relations are read from both sides with hyponym and hypernym inverted", async () => {
  const animal = await insertEntryWithSense(sql, { language: "en", text: "animal" });
  const dog = await insertEntryWithSense(sql, { language: "en", text: "dog" });
  await sql.exec(
    "INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type, strength, context_note) VALUES ($1, $2, 'hyponym', 7, 'kind of')",
    [animal.senseId, dog.senseId],
  );

  const fromAnimal = await loadForSave(animal.entryId);
  assert.deepEqual(fromAnimal.senses[0]?.relatedSenses, [
    { targetSenseId: dog.senseId, relationType: "hyponym", contextNote: "kind of", strength: 7 },
  ]);
  const fromDog = await loadForSave(dog.entryId);
  assert.deepEqual(fromDog.senses[0]?.relatedSenses, [
    { targetSenseId: animal.senseId, relationType: "hypernym", contextNote: "kind of", strength: 7 },
  ]);
});

test("a no-op save from either side leaves the stored relation rows untouched", async () => {
  const left = await insertEntryWithSense(sql, { language: "en", text: "left" });
  const right = await insertEntryWithSense(sql, { language: "en", text: "right" });
  const other = await insertEntryWithSense(sql, { language: "en", text: "other" });
  await sql.exec(
    "INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type, strength, context_note) VALUES ($1, $2, 'hyponym', 7, 'n1'), ($3, $1, 'near_synonym', 3, NULL)",
    [left.senseId, right.senseId, other.senseId],
  );
  const ids = [left.senseId, right.senseId, other.senseId];
  const before = await relationRows(ids);
  assert.equal(before.length, 2);

  await save(await loadForSave(right.entryId));
  assert.deepEqual(await relationRows(ids), before);

  await save(await loadForSave(left.entryId));
  assert.deepEqual(await relationRows(ids), before);

  await save(await loadForSave(other.entryId));
  assert.deepEqual(await relationRows(ids), before);
});

test("relations are edited, removed and added without disturbing untouched rows", async () => {
  const hub = await insertEntryWithSense(sql, { language: "en", text: "hub" });
  const kept = await insertEntryWithSense(sql, { language: "en", text: "kept" });
  const removed = await insertEntryWithSense(sql, { language: "en", text: "removed" });
  const added = await insertEntryWithSense(sql, { language: "en", text: "added" });
  await sql.exec(
    "INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type, strength) VALUES ($1, $2, 'synonym', 4), ($3, $1, 'antonym', 6)",
    [hub.senseId, kept.senseId, removed.senseId],
  );
  const ids = [hub.senseId, kept.senseId, removed.senseId, added.senseId];
  const [keptRow, removedRow] = await relationRows(ids);
  assert.ok(keptRow && removedRow);

  const loaded = await loadForSave(hub.entryId);
  await save(
    withSense(loaded, {
      relatedSenses: [
        { targetSenseId: kept.senseId, relationType: "synonym", contextNote: "now noted", strength: 9 },
        { targetSenseId: added.senseId, relationType: "hypernym", contextNote: null, strength: null },
      ],
    }),
  );

  const after = await relationRows(ids);
  assert.equal(after.length, 2);
  assert.deepEqual(after[0], { ...keptRow, context_note: "now noted", strength: 9 });
  assert.equal(after[1]?.sense_id_1, hub.senseId);
  assert.equal(after[1]?.sense_id_2, added.senseId);
  assert.equal(after[1]?.relation_type, "hypernym");
  assert.equal(after[1]?.strength, 5);
});

test("a sense id belonging to another entry cannot be overwritten", async () => {
  const victim = await insertEntryWithSense(sql, { language: "en", text: "victim" });
  const attacker = await insertEntryWithSense(sql, { language: "en", text: "attacker" });

  const loaded = await loadForSave(attacker.entryId);
  await assert.rejects(
    save(withSense(loaded, { id: victim.senseId, pos: "verb", definitions: ["overwritten"] })),
    /unexpected number of rows/,
  );

  const victimSense = await sql.one<{ pos: string; definitions: string[]; lexical_entry_id: number }>(
    "SELECT pos::text AS pos, definitions, lexical_entry_id FROM sense WHERE id = $1",
    [victim.senseId],
  );
  assert.deepEqual(victimSense, { pos: "noun", definitions: ["victim"], lexical_entry_id: victim.entryId });
  const attackerSenses = await sql.column<number>("SELECT id FROM sense WHERE lexical_entry_id = $1", [
    attacker.entryId,
  ]);
  assert.deepEqual(attackerSenses, [attacker.senseId]);
});

test("senses created through the repository are linked to the new entry", async () => {
  const target = await insertEntryWithSense(sql, { language: "ar", text: "هدف", root: "هدف" });
  const created = await entries.createLexicalEntry({
    language: "en",
    text: "goal",
    root: null,
    morphPatternId: null,
    morphologyOverrides: { no_passive: false },
    isVerified: true,
    senses: [
      {
        pos: "noun",
        senseNumber: 1,
        definitions: ["an aim"],
        examples: [],
        translations: [{ targetSenseId: target.senseId, domain: null, note: null }],
        relatedSenses: [],
      },
    ],
  });
  const loaded = await loadForSave(created.id);
  assert.deepEqual(loaded.senses[0]?.translations, [{ targetSenseId: target.senseId, domain: null, note: null }]);
});

test("a duplicate entry surfaces the violated constraint name", async () => {
  await insertEntryWithSense(sql, { language: "en", text: "duplicate" });
  const input = {
    language: "en" as const,
    text: "duplicate",
    root: null,
    morphPatternId: null,
    morphologyOverrides: { no_passive: false },
    isVerified: false,
    senses: [],
  };
  const error = await entries.createLexicalEntry(input).then(
    () => null,
    (caught: unknown) => caught,
  );
  assert.ok(error);
  assert.equal(pgError.isUniqueViolation(error), true);
  assert.equal(pgError.isUniqueViolation(error, "unique_language_text"), true);
  assert.equal(pgError.isUniqueViolation(error, "unique_sense_number"), false);
});
