import assert from "node:assert/strict";
import { test } from "node:test";
import {
  invalidRootMessage,
  mapEntrySaveError,
  mapOverrideSaveError,
  mapPatternSaveError,
  UNIQUE_ENTRY_CONSTRAINT,
  UNIQUE_OVERRIDE_CONSTRAINT,
  UNIQUE_PATTERN_CONSTRAINT,
  UNIQUE_PATTERN_RESOLUTION_CONSTRAINT,
  UNIQUE_SENSE_NUMBER_CONSTRAINT,
} from "~/server/actions/save-errors";
import { FOREIGN_KEY_VIOLATION_SQLSTATE, INVALID_ROOT_SQLSTATE, UNIQUE_VIOLATION_SQLSTATE } from "~/server/db/pg-error";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";

const { sql, entries, patterns, overrides } = await openRepository();

const wrapped = (cause: { code: string; constraint?: string; message?: string }) =>
  Object.assign(new Error("Failed query"), { cause });

const unique = (constraint: string) => wrapped({ code: UNIQUE_VIOLATION_SQLSTATE, constraint });

const failure = (result: ReturnType<typeof mapEntrySaveError>) => {
  assert.equal(result.ok, false);
  return result.ok ? "" : result.error;
};

test("an entry save maps each unique constraint to its own message", () => {
  assert.equal(
    failure(mapEntrySaveError(unique(UNIQUE_ENTRY_CONSTRAINT), null)),
    "An entry with this language and text already exists",
  );
  assert.equal(
    failure(mapEntrySaveError(unique(UNIQUE_SENSE_NUMBER_CONSTRAINT), null)),
    "Sense numbers must be unique within an entry",
  );
});

test("an entry save reports the invalid root only when a root was submitted", () => {
  const invalidRoot = wrapped({ code: INVALID_ROOT_SQLSTATE, message: "root must have exactly 3 radicals" });
  assert.equal(failure(mapEntrySaveError(invalidRoot, "ترجم")), invalidRootMessage("ترجم"));
  assert.equal(invalidRootMessage("ترجم"), "Root 'ترجم' is not a valid triliteral root");
  assert.throws(() => mapEntrySaveError(invalidRoot, null), /Failed query/);
});

test("an entry save rethrows anything it does not recognise", () => {
  for (const error of [
    unique("some_other_constraint"),
    wrapped({ code: "40001" }),
    new Error("connection reset"),
    "not an error",
    null,
  ]) {
    assert.throws(() => mapEntrySaveError(error, "كتب"));
  }
});

test("a pattern save maps the description, the resolution key and rethrows other violations", () => {
  const description = failure(
    mapPatternSaveError(unique(UNIQUE_PATTERN_CONSTRAINT), { formNumber: 2, description: "a ~ u" }),
  );
  assert.equal(description, 'A form II pattern with description "a ~ u" already exists');

  const resolution = failure(
    mapPatternSaveError(unique(UNIQUE_PATTERN_RESOLUTION_CONSTRAINT), { formNumber: 2, description: "x" }),
  );
  assert.match(resolution, /Another pattern already handles this combination of root shape, form and vowels/);
  assert.notEqual(resolution, description);

  assert.throws(() => mapPatternSaveError(unique("unique_something_else"), { formNumber: 1, description: "" }));
  assert.throws(() => mapPatternSaveError(new Error("boom"), { formNumber: 1, description: "" }));
});

test("an override save maps its unique constraint and rethrows the rest", () => {
  assert.equal(
    failure(mapOverrideSaveError(unique(UNIQUE_OVERRIDE_CONSTRAINT))),
    "An override for this root, form number, and vowels already exists",
  );
  assert.throws(() => mapOverrideSaveError(unique(UNIQUE_ENTRY_CONSTRAINT)));
});

test("a foreign key violation on an override save says the pattern is gone", () => {
  assert.equal(
    failure(mapOverrideSaveError(wrapped({ code: FOREIGN_KEY_VIOLATION_SQLSTATE }))),
    "The morphological pattern no longer exists",
  );
});

test("an error carrying the SQLSTATE directly is recognised like a wrapped one", () => {
  const direct = Object.assign(new Error("duplicate key"), {
    code: UNIQUE_VIOLATION_SQLSTATE,
    constraint: UNIQUE_ENTRY_CONSTRAINT,
  });
  assert.equal(failure(mapEntrySaveError(direct, null)), "An entry with this language and text already exists");
});

const catchError = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("expected the call to fail");
};

test("real duplicate entries and duplicate sense numbers map to their own messages", async () => {
  await insertEntryWithSense(sql, { language: "en", text: "duplicate word" });
  const base = {
    language: "en" as const,
    root: null,
    morphPatternId: null,
    morphologyOverrides: { no_passive: false },
    isVerified: false,
  };
  const duplicate = await catchError(() => entries.createLexicalEntry({ ...base, text: "duplicate word", senses: [] }));
  assert.equal(failure(mapEntrySaveError(duplicate, null)), "An entry with this language and text already exists");

  const sense = {
    pos: "noun" as const,
    senseNumber: 1,
    definitions: ["x"],
    examples: [],
    translations: [],
    relatedSenses: [],
  };
  const sameNumber = await catchError(() =>
    entries.createLexicalEntry({ ...base, text: "two senses same number", senses: [sense, { ...sense }] }),
  );
  assert.equal(failure(mapEntrySaveError(sameNumber, null)), "Sense numbers must be unique within an entry");
});

test("real duplicate overrides and duplicate pattern descriptions map to their messages", async () => {
  const pattern = await patterns.resolveVerbMorphPattern("كتب", "form-1-a-u");
  assert.ok(pattern);
  const override = {
    morphPatternId: pattern.id,
    root: "كتب",
    formNumber: 1,
    perfectVowel: "a" as const,
    imperfectVowel: "u" as const,
  };
  await overrides.createOverride(override);
  const duplicateOverride = await catchError(() => overrides.createOverride(override));
  assert.equal(
    failure(mapOverrideSaveError(duplicateOverride)),
    "An override for this root, form number, and vowels already exists",
  );

  const stored = await patterns.getMorphPatternById(pattern.id);
  assert.ok(stored);
  const { id: _id, createdAt: _createdAt, ...copy } = stored;
  const duplicatePattern = await catchError(() => patterns.createMorphPattern({ ...copy, isLexical: true }));
  const message = failure(
    mapPatternSaveError(duplicatePattern, { formNumber: copy.formNumber, description: copy.description }),
  );
  assert.ok(
    message === `A form I pattern with description "${copy.description}" already exists` ||
      message.startsWith("Another pattern already handles this combination"),
    message,
  );
});
