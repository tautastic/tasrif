import assert from "node:assert/strict";
import { test } from "node:test";
import { entryEditSchema } from "~/components/admin/entry-edit-form/schema";
import {
  addContextTags,
  contextTagsSchema,
  dedupeContextTags,
  hasTagSeparator,
  MAX_CONTEXT_TAG_LENGTH,
  MAX_CONTEXT_TAGS,
  normalizeContextTag,
} from "~/lib/validation/contextTags";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";

const { sql, entries } = await openRepository();

type EditableEntry = NonNullable<Awaited<ReturnType<typeof entries.getLexicalEntryForEdit>>>;

const load = async (entryId: number) => {
  const loaded = await entries.getLexicalEntryForEdit(entryId);
  assert.ok(loaded);
  return loaded;
};

const save = async (entry: EditableEntry) => {
  const parsed = entryEditSchema.safeParse({
    ...entry,
    verbFormChoice: null,
    morphologyOverrides: entry.morphologyOverrides ?? { no_passive: false },
  });
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  const { verbFormChoice: _choice, ...persistable } = parsed.data;
  return entries.updateLexicalEntry({ ...persistable, morphPatternId: null });
};

const storedTags = (senseId: number) =>
  sql.column<string>("SELECT unnest(context_tags) FROM sense WHERE id = $1", [senseId]);

const withFirstSense = (entry: EditableEntry, changes: Record<string, unknown>) =>
  ({
    ...entry,
    senses: entry.senses.map((sense, index) => (index === 0 ? { ...sense, ...changes } : sense)),
  }) as EditableEntry;

test("a tag is trimmed, composed to NFC and has its inner whitespace collapsed", () => {
  assert.equal(normalizeContextTag("  legal \t  term  "), "legal term");
  assert.equal(normalizeContextTag("آ"), "آ");
});

test("tags are deduplicated case-insensitively and keep the first spelling and order", () => {
  assert.deepEqual(dedupeContextTags(["Legal", "slang", "legal", "SLANG", "formal"]), ["Legal", "slang", "formal"]);
  assert.deepEqual(contextTagsSchema.parse([" Legal ", "legal", "قانوني", "slang"]), ["Legal", "قانوني", "slang"]);
});

test("a tag must have between 1 and 40 characters", () => {
  assert.equal(contextTagsSchema.safeParse(["a".repeat(MAX_CONTEXT_TAG_LENGTH)]).success, true);
  assert.equal(contextTagsSchema.safeParse(["a".repeat(MAX_CONTEXT_TAG_LENGTH + 1)]).success, false);
  assert.equal(contextTagsSchema.safeParse(["   "]).success, false);
  assert.equal(contextTagsSchema.safeParse([""]).success, false);
});

test("at most ten distinct tags are accepted and duplicates do not count", () => {
  const ten = Array.from({ length: MAX_CONTEXT_TAGS }, (_, i) => `tag${i}`);
  assert.equal(contextTagsSchema.safeParse(ten).success, true);
  assert.equal(contextTagsSchema.safeParse([...ten, "tag11"]).success, false);
  assert.equal(contextTagsSchema.safeParse([...ten, "TAG0"]).success, true);
});

test("the tag input helper splits on commas, Arabic commas and newlines and rejects bad input without changing the list", () => {
  assert.deepEqual(addContextTags(["a"], "b, c،d\ne"), { tags: ["a", "b", "c", "d", "e"], error: null });
  assert.deepEqual(addContextTags(["a"], "A, a"), { tags: ["a"], error: null });
  assert.deepEqual(addContextTags(["a"], " , ,"), { tags: ["a"], error: null });
  const tooLong = addContextTags(["a"], `ok, ${"x".repeat(MAX_CONTEXT_TAG_LENGTH + 1)}`);
  assert.deepEqual(tooLong.tags, ["a"]);
  assert.match(tooLong.error ?? "", /at most 40/);
  const full = Array.from({ length: MAX_CONTEXT_TAGS }, (_, i) => `t${i}`);
  const overflow = addContextTags(full, "one more");
  assert.deepEqual(overflow.tags, full);
  assert.match(overflow.error ?? "", /at most 10/);
  assert.equal(hasTagSeparator("a،b"), true);
  assert.equal(hasTagSeparator("ab"), false);
});

test("context tags are written on create and read back for editing and for the public page", async () => {
  const created = await entries.createLexicalEntry({
    language: "en",
    text: "tagged",
    root: null,
    morphPatternId: null,
    morphologyOverrides: { no_passive: false },
    isVerified: true,
    senses: [
      {
        pos: "noun",
        senseNumber: 1,
        definitions: ["something tagged"],
        contextTags: ["legal", "formal"],
        examples: [],
        translations: [],
        relatedSenses: [],
      },
    ],
  });
  const loaded = await load(created.id);
  assert.deepEqual(loaded.senses[0]?.contextTags, ["legal", "formal"]);

  const page = await entries.getLexicalEntryBySlug("tagged");
  assert.deepEqual(page?.entries[0]?.senses[0]?.contextTags, ["legal", "formal"]);
});

test("saving unrelated fields keeps the stored tags, with or without the tags in the submitted form", async () => {
  const fixture = await insertEntryWithSense(sql, { language: "en", text: "keeper" });
  await sql.exec("UPDATE sense SET context_tags = ARRAY['colloquial','rare'] WHERE id = $1", [fixture.senseId]);

  const loaded = await load(fixture.entryId);
  await save(withFirstSense(loaded, { definitions: ["a changed definition"] }));
  assert.deepEqual(await storedTags(fixture.senseId), ["colloquial", "rare"]);

  const { contextTags: _omitted, ...withoutTags } = (await load(fixture.entryId)).senses[0] ?? {};
  const reloaded = await load(fixture.entryId);
  await save({ ...reloaded, senses: [withoutTags as EditableEntry["senses"][number]] });
  assert.deepEqual(await storedTags(fixture.senseId), ["colloquial", "rare"]);
  assert.deepEqual((await load(fixture.entryId)).senses[0]?.definitions, ["a changed definition"]);
});

test("submitted tags replace the stored tags and an empty list clears them", async () => {
  const fixture = await insertEntryWithSense(sql, { language: "en", text: "retag" });
  await sql.exec("UPDATE sense SET context_tags = ARRAY['old'] WHERE id = $1", [fixture.senseId]);

  await save(withFirstSense(await load(fixture.entryId), { contextTags: ["  New ", "new", "other"] }));
  assert.deepEqual(await storedTags(fixture.senseId), ["New", "other"]);

  await save(withFirstSense(await load(fixture.entryId), { contextTags: [] }));
  assert.deepEqual(await storedTags(fixture.senseId), []);
});

test("tags belong to their own sense when an entry has several", async () => {
  const fixture = await insertEntryWithSense(sql, { language: "en", text: "two senses" });
  const loaded = await load(fixture.entryId);
  const first = loaded.senses[0];
  assert.ok(first);
  await save({
    ...loaded,
    senses: [
      { ...first, contextTags: ["first"] },
      {
        pos: "verb",
        senseNumber: 2,
        definitions: ["second"],
        contextTags: ["second", "extra"],
        examples: [],
        translations: [],
        relatedSenses: [],
      } as unknown as EditableEntry["senses"][number],
    ],
  });
  const after = await load(fixture.entryId);
  assert.deepEqual(
    after.senses.map((sense) => sense.contextTags),
    [["first"], ["second", "extra"]],
  );
});

test("the entry schema rejects too many or too long tags on the sense that has them", () => {
  const base = {
    id: 1,
    language: "en" as const,
    text: "x",
    root: null,
    verbFormChoice: null,
    senses: [
      {
        pos: "noun" as const,
        senseNumber: 1,
        definitions: [],
        examples: [],
        translations: [],
        relatedSenses: [],
        contextTags: Array.from({ length: MAX_CONTEXT_TAGS + 1 }, (_, i) => `t${i}`),
      },
    ],
  };
  const result = entryEditSchema.safeParse(base);
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["senses", 0, "contextTags"]);
});
