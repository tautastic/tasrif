import assert from "node:assert/strict";
import { test } from "node:test";
import "./next-runtime.ts";
import { insertEntryWithSense, openRepository } from "./repository-db.ts";
import { revalidations } from "./stubs/next-cache.ts";
import { setRequestScope } from "./stubs/next-headers.ts";

const { sql, patterns } = await openRepository();

const session = await import("~/server/auth/session");
const entryActions = await import("~/server/actions/lexical-entry");
const patternActions = await import("~/server/actions/morph-pattern");
const overrideActions = await import("~/server/actions/lexical-pattern-override");
const { MAX_BULK_IDS } = await import("~/lib/validation/ids");

await sql.exec("DELETE FROM morph_pattern WHERE form_number = 10");
const sourcePattern = await patterns.getMorphPatternById(1);
assert.ok(sourcePattern);

const asAdmin = async () =>
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: await session.createSessionToken() } });
const asAnonymous = () => setRequestScope({});

const redirectOf = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2];
    }
    throw error;
  }
  return null;
};

const expectFailure = (result: { ok: boolean; error?: string }, pattern: RegExp) => {
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", pattern);
};

const revalidated = async (run: () => Promise<unknown>) => {
  const before = revalidations.length;
  await run();
  return revalidations.length - before;
};

const sense = (definition = "a definition", pos: "noun" | "verb" = "noun") => ({
  pos,
  senseNumber: 1,
  definitions: [definition],
  examples: [],
  translations: [],
  relatedSenses: [],
});

const englishEntry = (text: string) => ({
  language: "en" as const,
  text,
  root: null,
  verbFormChoice: null,
  senses: [sense()],
  isVerified: true,
  morphologyOverrides: { no_passive: false },
});

const arabicVerb = (text: string, root: string, verbFormChoice: "form-1-a-u" | "form-10") => ({
  language: "ar" as const,
  text,
  root,
  verbFormChoice,
  senses: [sense("to write", "verb")],
  isVerified: true,
  morphologyOverrides: { no_passive: false },
});

test("every action refuses an anonymous caller before touching anything", async () => {
  asAnonymous();
  const calls: Record<string, () => Promise<unknown>> = {
    createLexicalEntryAction: () => entryActions.createLexicalEntryAction(englishEntry("anon") as never),
    updateLexicalEntryAction: () => entryActions.updateLexicalEntryAction({ ...englishEntry("anon"), id: 1 } as never),
    deleteLexicalEntryAction: () => entryActions.deleteLexicalEntryAction(1),
    deleteLexicalEntriesAction: () => entryActions.deleteLexicalEntriesAction([1]),
    createMorphPatternAction: () => patternActions.createMorphPatternAction({} as never),
    updateMorphPatternAction: () => patternActions.updateMorphPatternAction({} as never),
    deleteMorphPatternAction: () => patternActions.deleteMorphPatternAction(1),
    deleteMorphPatternsAction: () => patternActions.deleteMorphPatternsAction([1]),
    previewMorphPatternAction: () => patternActions.previewMorphPatternAction({} as never),
    createOverrideAction: () => overrideActions.createOverrideAction(1, {} as never),
    updateOverrideAction: () => overrideActions.updateOverrideAction(1, {} as never),
    deleteOverrideAction: () => overrideActions.deleteOverrideAction(1, 1),
  };
  const before = await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry");
  for (const [name, call] of Object.entries(calls)) {
    await assert.rejects(call(), /Unauthorized/, name);
  }
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry"), before);
});

test("creating an entry returns the saved identity and revalidates the public pages", async () => {
  await asAdmin();
  let result: Awaited<ReturnType<typeof entryActions.createLexicalEntryAction>> | undefined;
  const count = await revalidated(async () => {
    result = await entryActions.createLexicalEntryAction(englishEntry("Action Book") as never);
  });
  assert.ok(result?.ok);
  assert.deepEqual(result.data, { id: result.data.id, slug: "action-book", isVerified: true });
  assert.ok(count > 0);
  assert.equal(
    await sql.scalar<string>("SELECT text FROM lexical_entry WHERE id = $1", [result.data.id]),
    "Action Book",
  );
});

test("invalid entry data comes back as an ActionResult listing every problem and saves nothing", async () => {
  await asAdmin();
  const before = await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry");
  let result: Awaited<ReturnType<typeof entryActions.createLexicalEntryAction>> | undefined;
  const count = await revalidated(async () => {
    result = await entryActions.createLexicalEntryAction({ ...englishEntry(""), language: "xx" } as never);
  });
  expectFailure(result as never, /^Invalid entry data — /);
  assert.match((result as { error: string }).error, /language: Language must be 'en' or 'ar'/);
  assert.match((result as { error: string }).error, /text: Text is required/);
  assert.equal(count, 0);
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry"), before);

  const garbage = await entryActions.createLexicalEntryAction("not an object" as never);
  expectFailure(garbage, /^Invalid entry data — /);
});

test("a duplicate entry and a failed pattern lookup are reported as messages", async () => {
  await asAdmin();
  await insertEntryWithSense(sql, { language: "en", text: "taken" });
  expectFailure(
    await entryActions.createLexicalEntryAction(englishEntry("taken") as never),
    /^An entry with this language and text already exists$/,
  );

  const noPattern = await entryActions.createLexicalEntryAction(arabicVerb("اِسْتَفْعَلَ", "كتب", "form-10") as never);
  expectFailure(noPattern, /^No morphological pattern is available yet for root 'كتب' in Form X$/);

  const unclassifiable = await entryActions.createLexicalEntryAction(arabicVerb("شيء", "ab", "form-1-a-u") as never);
  expectFailure(unclassifiable, /^Invalid entry data — /);

  const created = await entryActions.createLexicalEntryAction(arabicVerb("كَتَبَ", "كتب", "form-1-a-u") as never);
  assert.ok(created.ok);
  const stored = await sql.one<{ morph_pattern_id: number | null; masdar: string | null }>(
    "SELECT morph_pattern_id, masdar FROM lexical_entry WHERE id = $1",
    [created.ok ? created.data.id : 0],
  );
  assert.ok(stored.morph_pattern_id);
  assert.ok(stored.masdar);
});

test("updating reports a vanished entry and keeps working on a real one", async () => {
  await asAdmin();
  const fixture = await insertEntryWithSense(sql, { language: "en", text: "to update" });
  const ok = await entryActions.updateLexicalEntryAction({
    ...englishEntry("updated word"),
    id: fixture.entryId,
    senses: [{ ...sense("new definition"), id: fixture.senseId }],
  } as never);
  assert.ok(ok.ok);
  assert.equal(
    await sql.scalar<string>("SELECT text FROM lexical_entry WHERE id = $1", [fixture.entryId]),
    "updated word",
  );

  expectFailure(
    await entryActions.updateLexicalEntryAction({ ...englishEntry("ghost"), id: 987654 } as never),
    /^Lexical entry with id '987654' no longer exists$/,
  );
  expectFailure(
    await entryActions.updateLexicalEntryAction({ ...englishEntry("x"), id: -3 } as never),
    /^Invalid entry data — id: /,
  );
  expectFailure(
    await entryActions.updateLexicalEntryAction({ ...englishEntry("x"), id: 1.5 } as never),
    /^Invalid entry data — id: /,
  );
});

test("renaming an entry revalidates its old and its new entry page", async () => {
  await asAdmin();
  const fixture = await insertEntryWithSense(sql, { language: "en", text: "former title" });
  revalidations.length = 0;
  const renamed = await entryActions.updateLexicalEntryAction({
    ...englishEntry("current title"),
    id: fixture.entryId,
    senses: [{ ...sense("a definition"), id: fixture.senseId }],
  } as never);
  assert.ok(renamed.ok);
  assert.deepEqual(renamed.data, { id: fixture.entryId, slug: "current-title", isVerified: true });
  const paths = revalidations.map((entry) => entry.path);
  assert.ok(paths.includes("/entry/former-title"));
  assert.ok(paths.includes("/entry/current-title"));
  assert.ok(paths.includes("/"));

  revalidations.length = 0;
  await entryActions.updateLexicalEntryAction({
    ...englishEntry("current title"),
    id: fixture.entryId,
    senses: [{ ...sense("another definition"), id: fixture.senseId }],
  } as never);
  assert.deepEqual(
    revalidations.filter((entry) => entry.path.startsWith("/entry/")).map((entry) => entry.path),
    ["/entry/current-title"],
  );
});

test("creating and deleting an entry revalidate its entry page", async () => {
  await asAdmin();
  revalidations.length = 0;
  const created = await entryActions.createLexicalEntryAction(englishEntry("Fresh Phrase") as never);
  assert.ok(created.ok);
  assert.ok(revalidations.some((entry) => entry.path === "/entry/fresh-phrase"));

  revalidations.length = 0;
  await redirectOf(() => entryActions.deleteLexicalEntryAction(created.data.id));
  assert.ok(revalidations.some((entry) => entry.path === "/entry/fresh-phrase"));
});

test("deleting one entry redirects home and reports a missing one", async () => {
  await asAdmin();
  const fixture = await insertEntryWithSense(sql, { language: "en", text: "to delete" });
  let destination: string | null | undefined;
  const count = await revalidated(async () => {
    destination = await redirectOf(() => entryActions.deleteLexicalEntryAction(fixture.entryId));
  });
  assert.equal(destination, "/");
  assert.ok(count > 0);
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry WHERE id = $1", [fixture.entryId]), 0);

  expectFailure(
    await entryActions.deleteLexicalEntryAction(fixture.entryId),
    /^Failed to delete lexical entry with id /,
  );
});

test("bulk deleting entries validates the id list and reports partial failures", async () => {
  await asAdmin();
  const first = await insertEntryWithSense(sql, { language: "en", text: "bulk one" });
  const second = await insertEntryWithSense(sql, { language: "en", text: "bulk two" });

  for (const bad of [
    [0],
    [-1],
    [1.5],
    ["1"],
    [Number.NaN],
    "1,2",
    null,
    Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => i + 1),
  ]) {
    expectFailure(await entryActions.deleteLexicalEntriesAction(bad as never), /^Invalid entry ids — /);
  }
  assert.equal(
    await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry WHERE id = ANY($1::int[])", [
      `{${first.entryId},${second.entryId}}`,
    ]),
    2,
  );

  expectFailure(
    await entryActions.deleteLexicalEntriesAction([first.entryId, 987654, 987655]),
    /^Failed to delete 2 lexical entries$/,
  );
  expectFailure(await entryActions.deleteLexicalEntriesAction([987654]), /^Failed to delete 1 lexical entry$/);
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry WHERE id = $1", [first.entryId]), 0);

  const count = await revalidated(async () => {
    const done = await entryActions.deleteLexicalEntriesAction([second.entryId, second.entryId]);
    assert.deepEqual(done, { ok: true, data: undefined });
  });
  assert.ok(count > 0);
  assert.deepEqual(await entryActions.deleteLexicalEntriesAction([]), { ok: true, data: undefined });
});

const newPattern = (overrides: Record<string, unknown> = {}) => {
  assert.ok(sourcePattern);
  const { id: _id, createdAt: _createdAt, ...copy } = sourcePattern;
  return { ...copy, isLexical: true, description: "action test pattern", ...overrides };
};

test("a pattern is created, rejected when invalid and mapped when it duplicates another", async () => {
  await asAdmin();
  let created: Awaited<ReturnType<typeof patternActions.createMorphPatternAction>> | undefined;
  const count = await revalidated(async () => {
    created = await patternActions.createMorphPatternAction(newPattern() as never);
  });
  assert.ok(created?.ok);
  assert.ok(count > 0);

  expectFailure(
    await patternActions.createMorphPatternAction(newPattern() as never),
    /^A form I pattern with description "action test pattern" already exists$|^Another pattern already handles/,
  );
  expectFailure(
    await patternActions.createMorphPatternAction(newPattern({ rules: { perfect: "{1}{4}" } }) as never),
    /^Invalid pattern data — .*Unknown placeholder "\{4\}"/,
  );
  expectFailure(
    await patternActions.createMorphPatternAction(newPattern({ formNumber: 99 }) as never),
    /^Invalid pattern data — /,
  );
});

test("a non-lexical pattern that shadows an existing root shape is refused with the pattern it collides with", async () => {
  await asAdmin();
  const result = await patternActions.createMorphPatternAction(
    newPattern({ isLexical: false, description: "shadow of pattern one" }) as never,
  );
  expectFailure(result, /^Pattern #\d+ \(".*"\) already matches this exact root shape and vowel combination/);
});

test("updating a pattern reports a vanished one and updates a real one", async () => {
  await asAdmin();
  const created = await patternActions.createMorphPatternAction(newPattern({ description: "to be edited" }) as never);
  assert.ok(created.ok);
  const updated = await patternActions.updateMorphPatternAction({
    ...newPattern({ description: "edited description" }),
    id: created.data.id,
  } as never);
  assert.deepEqual(updated, { ok: true, data: { id: created.data.id } });
  assert.equal(
    await sql.scalar<string>("SELECT description FROM morph_pattern WHERE id = $1", [created.data.id]),
    "edited description",
  );
  expectFailure(
    await patternActions.updateMorphPatternAction({ ...newPattern(), id: 987654 } as never),
    /^Morphological pattern with id '987654' no longer exists$/,
  );
});

test("deleting a pattern is refused while an entry or an override uses it", async () => {
  await asAdmin();
  const entry = await entryActions.createLexicalEntryAction(arabicVerb("كَتَبَ ٢", "كتب", "form-1-a-u") as never);
  assert.ok(entry.ok);
  const patternId = await sql.scalar<number>("SELECT morph_pattern_id FROM lexical_entry WHERE id = $1", [
    entry.data.id,
  ]);

  expectFailure(
    await patternActions.deleteMorphPatternAction(patternId),
    /^Cannot delete: still referenced by \d+ entr(y|ies) and \d+ overrides?$/,
  );
  expectFailure(
    await patternActions.deleteMorphPatternsAction([patternId]),
    new RegExp(`^Cannot delete: pattern\\(s\\) ${patternId} still referenced by entries or overrides$`),
  );
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM morph_pattern WHERE id = $1", [patternId]), 1);
});

test("unused patterns are deleted singly and in bulk, with ids validated and failures counted", async () => {
  await asAdmin();
  const make = async (description: string) => {
    const created = await patternActions.createMorphPatternAction(newPattern({ description }) as never);
    assert.ok(created.ok);
    return created.data.id;
  };
  const single = await make("delete me alone");
  const destination = await redirectOf(() => patternActions.deleteMorphPatternAction(single));
  assert.equal(destination, "/admin/morph-patterns");
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM morph_pattern WHERE id = $1", [single]), 0);
  expectFailure(
    await patternActions.deleteMorphPatternAction(single),
    /^Failed to delete morphological pattern with id /,
  );

  for (const bad of [[0], [2.5], ["3"], "3", null, Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => i + 1)]) {
    expectFailure(await patternActions.deleteMorphPatternsAction(bad as never), /^Invalid pattern ids — /);
  }
  const one = await make("bulk delete one");
  const two = await make("bulk delete two");
  expectFailure(await patternActions.deleteMorphPatternsAction([one, 987654]), /^Failed to delete 1 pattern$/);
  assert.deepEqual(await patternActions.deleteMorphPatternsAction([two, two]), { ok: true, data: undefined });
});

test("the preview action validates its input and returns the paradigm for a valid root", async () => {
  await asAdmin();
  assert.ok(sourcePattern);
  const valid = await patternActions.previewMorphPatternAction({
    root: " ك ت ب ",
    rules: sourcePattern.rules,
    formNumber: 1,
    noAffix: false,
  });
  assert.ok(valid.ok);
  assert.ok(valid.data.conjugation.length > 0);
  assert.ok(valid.data.conjugation.every((cell) => cell.form.includes("كتب".slice(0, 1))));
  assert.ok(valid.data.verbalNouns.masdar);

  expectFailure(
    await patternActions.previewMorphPatternAction({
      root: "ترجم",
      rules: sourcePattern.rules,
      formNumber: 1,
      noAffix: false,
    }),
    /^Invalid preview input — root: Root must have exactly 3 letters$/,
  );
  expectFailure(
    await patternActions.previewMorphPatternAction({
      root: "كتب",
      rules: { perfect: "{9}" },
      formNumber: 1,
      noAffix: false,
    } as never),
    /^Invalid preview input — /,
  );
  expectFailure(
    await patternActions.previewMorphPatternAction({
      root: "كتب",
      rules: sourcePattern.rules,
      formNumber: 11,
      noAffix: false,
    }),
    /^Invalid preview input — formNumber: /,
  );
});

const overrideInput = (overrides: Record<string, unknown> = {}) => ({
  root: "سأل",
  formNumber: 1,
  perfectVowel: "a",
  imperfectVowel: "a",
  note: " a note ",
  ...overrides,
});

test("overrides are created, deduplicated, edited and deleted with friendly results", async () => {
  await asAdmin();
  const created = await overrideActions.createOverrideAction(1, overrideInput() as never);
  assert.ok(created.ok);
  const row = await sql.one<{ note: string | null; morph_pattern_id: number }>(
    "SELECT note, morph_pattern_id FROM lexical_pattern_override WHERE id = $1",
    [created.data.id],
  );
  assert.deepEqual(row, { note: "a note", morph_pattern_id: 1 });

  expectFailure(
    await overrideActions.createOverrideAction(1, overrideInput() as never),
    /^An override for this root, form number, and vowels already exists$/,
  );
  expectFailure(
    await overrideActions.createOverrideAction(1, overrideInput({ root: "abcd" }) as never),
    /^Invalid override data — root: /,
  );
  expectFailure(
    await overrideActions.createOverrideAction(1, overrideInput({ perfectVowel: null }) as never),
    /^Invalid override data — perfectVowel: Form I needs both/,
  );

  const updated = await overrideActions.updateOverrideAction(
    1,
    overrideInput({ id: created.data.id, note: "" }) as never,
  );
  assert.deepEqual(updated, { ok: true, data: { id: created.data.id } });
  assert.equal(
    await sql.scalar<string | null>("SELECT note FROM lexical_pattern_override WHERE id = $1", [created.data.id]),
    null,
  );
  expectFailure(
    await overrideActions.updateOverrideAction(1, overrideInput({ id: 987654 }) as never),
    /^Override with id '987654' no longer exists$/,
  );

  const destination = await redirectOf(() => overrideActions.deleteOverrideAction(1, created.data.id));
  assert.equal(destination, "/admin/morph-patterns/1");
  expectFailure(await overrideActions.deleteOverrideAction(1, created.data.id), /^Failed to delete override with id /);
});

test("an override cannot be created for, moved to or deleted through the wrong pattern", async () => {
  await asAdmin();
  const created = await overrideActions.createOverrideAction(1, overrideInput({ root: "قرأ" }) as never);
  assert.ok(created.ok);

  expectFailure(
    await overrideActions.createOverrideAction(987654, overrideInput({ root: "قرأ", perfectVowel: "i" }) as never),
    /^The morphological pattern no longer exists$/,
  );
  expectFailure(
    await overrideActions.updateOverrideAction(
      2,
      overrideInput({ id: created.data.id, root: "قرأ", note: "moved" }) as never,
    ),
    /^Override with id '\d+' no longer exists$/,
  );
  expectFailure(await overrideActions.deleteOverrideAction(2, created.data.id), /^Failed to delete override with id /);
  const row = await sql.one<{ morph_pattern_id: number; note: string | null }>(
    "SELECT morph_pattern_id, note FROM lexical_pattern_override WHERE id = $1",
    [created.data.id],
  );
  assert.deepEqual(row, { morph_pattern_id: 1, note: "a note" });
});

test("single-record actions validate their ids instead of throwing a database error", async () => {
  await asAdmin();
  for (const bad of [0, -1, 1.5, Number.NaN, "7", null, undefined]) {
    expectFailure(await entryActions.deleteLexicalEntryAction(bad as never), /^Invalid entry id — /);
    expectFailure(await patternActions.deleteMorphPatternAction(bad as never), /^Invalid pattern id — /);
    expectFailure(await overrideActions.deleteOverrideAction(bad as never, 1), /^Invalid override ids — /);
    expectFailure(await overrideActions.deleteOverrideAction(1, bad as never), /^Invalid override ids — /);
    expectFailure(
      await overrideActions.createOverrideAction(bad as never, overrideInput() as never),
      /^Invalid pattern id — /,
    );
    expectFailure(
      await overrideActions.updateOverrideAction(bad as never, overrideInput({ id: 1 }) as never),
      /^Invalid pattern id — /,
    );
  }
});

test("a null character anywhere in the submitted data is refused before it reaches the database", async () => {
  await asAdmin();
  const before = await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry");
  expectFailure(
    await entryActions.createLexicalEntryAction(englishEntry("bad\u0000text") as never),
    /^Invalid entry data — null characters are not allowed$/,
  );
  expectFailure(
    await entryActions.createLexicalEntryAction({ ...englishEntry("fine"), senses: [sense("a\u0000b")] } as never),
    /^Invalid entry data — null characters are not allowed$/,
  );
  expectFailure(
    await overrideActions.createOverrideAction(1, overrideInput({ note: "x\u0000" }) as never),
    /^Invalid override data — null characters are not allowed$/,
  );
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry"), before);
});
