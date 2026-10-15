import assert from "node:assert/strict";
import { test } from "node:test";
import "./next-runtime.ts";
import { openRepository } from "./repository-db.ts";
import { setRequestScope } from "./stubs/next-headers.ts";

const { sql } = await openRepository();

const session = await import("~/server/auth/session");
const entryActions = await import("~/server/actions/lexical-entry");
const overrideActions = await import("~/server/actions/lexical-pattern-override");
const route = await import("~/app/api/verb-form/variants/route");
const { formatPatternVariantLabel } = await import("~/lib/api/pattern-variants");

const asAdmin = async () =>
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: await session.createSessionToken() } });
const asAnonymous = () => setRequestScope({});

const patternId = (code: string) => sql.scalar<number>("SELECT id FROM morph_pattern WHERE code = $1", [code]);

const verbEntry = (
  text: string,
  root: string,
  verbFormChoice: "form-10" | "form-1-a-u",
  extra: Record<string, unknown> = {},
) => ({
  language: "ar" as const,
  text,
  root,
  verbFormChoice,
  senses: [
    { pos: "verb" as const, senseNumber: 1, definitions: [text], examples: [], translations: [], relatedSenses: [] },
  ],
  isVerified: true,
  morphologyOverrides: { no_passive: false },
  ...extra,
});

const storedPattern = (id: number) =>
  sql.scalar<number | null>("SELECT morph_pattern_id FROM lexical_entry WHERE id = $1", [id]);

const hollow = await patternId("f10-hollow-waw");
const strong = await patternId("f10-hollow-strong-inflection");
const unrelated = await patternId("f1-a-u");

test("an entry without a choice gets the resolved pattern, as before variants existed", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(verbEntry("اِسْتَجَابَ", "جوب", "form-10") as never);
  assert.ok(created.ok);
  assert.equal(await storedPattern(created.data.id), hollow);
});

test("a variant can be chosen and is stored with its own paradigm", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(
    verbEntry("اِسْتَجْوَبَ", "جوب", "form-10", { chosenMorphPatternId: strong }) as never,
  );
  assert.ok(created.ok);
  assert.equal(await storedPattern(created.data.id), strong);
  assert.equal(
    await sql.scalar<string>(
      "SELECT form FROM conjugation WHERE lexical_entry_id = $1 AND mood = 'perfect' AND person = 'third_person_masculine_singular'",
      [created.data.id],
    ),
    "اِسْتَجْوَبَ",
  );
});

test("the resolved pattern can be chosen explicitly", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(
    verbEntry("اِسْتَجَابَ explicit", "جوب", "form-10", { chosenMorphPatternId: hollow }) as never,
  );
  assert.ok(created.ok);
  assert.equal(await storedPattern(created.data.id), hollow);
});

test("an arbitrary pattern id is refused and nothing is saved", async () => {
  await asAdmin();
  const before = await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry");
  for (const chosen of [unrelated, 987654]) {
    const result = await entryActions.createLexicalEntryAction(
      verbEntry(`refused ${chosen}`, "جوب", "form-10", { chosenMorphPatternId: chosen }) as never,
    );
    assert.deepEqual(result, {
      ok: false,
      error: "The chosen pattern is not available for root 'جوب' in Form X",
    });
  }
  const otherRoot = await entryActions.createLexicalEntryAction(
    verbEntry("refused other root", "كتب", "form-10", { chosenMorphPatternId: strong }) as never,
  );
  assert.deepEqual(otherRoot, {
    ok: false,
    error: "The chosen pattern is not available for root 'كتب' in Form X",
  });
  assert.equal(await sql.scalar<number>("SELECT count(*)::int FROM lexical_entry"), before);
});

test("a choice that is not a positive integer is refused by validation", async () => {
  await asAdmin();
  for (const chosen of [0, -3, 1.5, "7"]) {
    const result = await entryActions.createLexicalEntryAction(
      verbEntry("bad choice", "جوب", "form-10", { chosenMorphPatternId: chosen }) as never,
    );
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /^Invalid entry data — /);
  }
});

test("saving an entry again keeps its variant unless another pattern is chosen", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(
    verbEntry("اِسْتَجْوَبَ keep", "جوب", "form-10", { chosenMorphPatternId: strong }) as never,
  );
  assert.ok(created.ok);

  const untouched = await entryActions.updateLexicalEntryAction({
    ...verbEntry("اِسْتَجْوَبَ keep", "جوب", "form-10"),
    id: created.data.id,
  } as never);
  assert.ok(untouched.ok);
  assert.equal(await storedPattern(created.data.id), strong);

  const nulled = await entryActions.updateLexicalEntryAction({
    ...verbEntry("اِسْتَجْوَبَ keep", "جوب", "form-10", { chosenMorphPatternId: null }),
    id: created.data.id,
  } as never);
  assert.ok(nulled.ok);
  assert.equal(await storedPattern(created.data.id), strong);

  const back = await entryActions.updateLexicalEntryAction({
    ...verbEntry("اِسْتَجْوَبَ keep", "جوب", "form-10", { chosenMorphPatternId: hollow }),
    id: created.data.id,
  } as never);
  assert.ok(back.ok);
  assert.equal(await storedPattern(created.data.id), hollow);

  const again = await entryActions.updateLexicalEntryAction({
    ...verbEntry("اِسْتَجْوَبَ keep", "جوب", "form-10"),
    id: created.data.id,
  } as never);
  assert.ok(again.ok);
  assert.equal(await storedPattern(created.data.id), hollow);
});

test("changing the root drops a variant of the old root", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(
    verbEntry("اِسْتَجْوَبَ moved", "جوب", "form-10", { chosenMorphPatternId: strong }) as never,
  );
  assert.ok(created.ok);
  const moved = await entryActions.updateLexicalEntryAction({
    ...verbEntry("اِسْتَجْوَبَ moved", "كتب", "form-10"),
    id: created.data.id,
  } as never);
  assert.ok(moved.ok);
  assert.equal(await storedPattern(created.data.id), await patternId("f10"));
});

test("a choice is ignored for an entry without a verb form", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction({
    language: "en",
    text: "choice ignored",
    root: null,
    verbFormChoice: null,
    chosenMorphPatternId: strong,
    senses: [{ pos: "noun", senseNumber: 1, definitions: ["x"], examples: [], translations: [], relatedSenses: [] }],
    isVerified: true,
    morphologyOverrides: { no_passive: false },
  } as never);
  assert.ok(created.ok);
  assert.equal(await storedPattern(created.data.id), null);
});

const overrideInput = (overrides: Record<string, unknown> = {}) => ({
  root: "ثبت",
  formNumber: 10,
  perfectVowel: null,
  imperfectVowel: null,
  variant: "plain",
  note: "",
  ...overrides,
});

test("a variant override is created, listed, edited and refused for a pattern it does not fit", async () => {
  await asAdmin();
  const created = await overrideActions.createOverrideAction(strong, overrideInput() as never);
  assert.ok(created.ok);
  assert.equal(
    await sql.scalar<string>("SELECT variant FROM lexical_pattern_override WHERE id = $1", [created.data.id]),
    "plain",
  );

  const duplicate = await overrideActions.createOverrideAction(strong, overrideInput() as never);
  assert.deepEqual(duplicate, {
    ok: false,
    error: "An override for this root, form number, vowels and variant already exists",
  });

  const renamed = await overrideActions.updateOverrideAction(
    strong,
    overrideInput({ id: created.data.id, variant: "renamed" }) as never,
  );
  assert.ok(renamed.ok);
  assert.equal(
    await sql.scalar<string>("SELECT variant FROM lexical_pattern_override WHERE id = $1", [created.data.id]),
    "renamed",
  );

  const cleared = await overrideActions.updateOverrideAction(
    strong,
    overrideInput({ id: created.data.id, variant: "" }) as never,
  );
  assert.ok(cleared.ok);
  assert.equal(
    await sql.scalar<string | null>("SELECT variant FROM lexical_pattern_override WHERE id = $1", [created.data.id]),
    null,
  );

  assert.deepEqual(await overrideActions.createOverrideAction(hollow, overrideInput({ root: "ثبث" }) as never), {
    ok: false,
    error: "A variant has to point to a lexical pattern, one that describes a single verb",
  });
  assert.deepEqual(
    await overrideActions.createOverrideAction(strong, overrideInput({ root: "ثبث", formNumber: 9 }) as never),
    { ok: false, error: "The form and vowels of a variant must be those of its pattern" },
  );
  assert.deepEqual(await overrideActions.createOverrideAction(987654, overrideInput({ root: "ثبث" }) as never), {
    ok: false,
    error: "The morphological pattern no longer exists",
  });
});

test("a variant name that is not a short lower-case slug is refused", async () => {
  await asAdmin();
  for (const variant of ["Two Words", "-x", "x-", "1x", "عربي", "a".repeat(41), "a--b"]) {
    const result = await overrideActions.createOverrideAction(strong, overrideInput({ variant }) as never);
    assert.equal(result.ok, false, variant);
    assert.match(result.ok ? "" : result.error, /^Invalid override data — variant: /, variant);
  }
});

test("an override without a variant is still created on a non-lexical pattern, as before", async () => {
  await asAdmin();
  const created = await overrideActions.createOverrideAction(
    hollow,
    overrideInput({ root: "ثبج", variant: undefined }) as never,
  );
  assert.ok(created.ok);
  assert.equal(
    await sql.scalar<string | null>("SELECT variant FROM lexical_pattern_override WHERE id = $1", [created.data.id]),
    null,
  );
});

const get = (query: string) => new Request(`http://localhost:3000/api/verb-form/variants${query}`);

test("the variants route refuses an anonymous caller", async () => {
  asAnonymous();
  const response = await route.GET(get("?root=جوب&formChoice=form-10"));
  assert.equal(response.status, 401);
});

test("the variants route lists the choices and tells which one an entry uses", async () => {
  await asAdmin();
  const response = await route.GET(get(`?root=${encodeURIComponent("جوب")}&formChoice=form-10`));
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    variants: { id: number; variant: string | null; sample: string | null; isDefault: boolean }[];
    current: number | null;
  };
  assert.deepEqual(
    body.variants.map((option) => [option.id, option.variant, option.sample, option.isDefault]),
    [
      [hollow, null, "اِسْتَجَابَ", true],
      [strong, "interrogate", "اِسْتَجْوَبَ", false],
    ],
  );
  assert.equal(body.current, null);

  const entryId = await sql.scalar<number>(
    "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', 'route entry', 'جوب', $1) RETURNING id",
    [strong],
  );
  const withEntry = await route.GET(get(`?root=${encodeURIComponent("جوب")}&formChoice=form-10&entryId=${entryId}`));
  assert.equal(((await withEntry.json()) as { current: number | null }).current, strong);

  const otherRoot = await route.GET(get(`?root=${encodeURIComponent("كتب")}&formChoice=form-10&entryId=${entryId}`));
  const otherBody = (await otherRoot.json()) as { variants: unknown[]; current: number | null };
  assert.equal(otherBody.variants.length, 1);
  assert.equal(otherBody.current, null);
});

test("the variants route validates its query and answers an invalid root with no variants", async () => {
  await asAdmin();
  for (const query of [
    "",
    "?root=جوب",
    "?formChoice=form-10",
    "?root=جوب&formChoice=form-11",
    "?root=جوب&formChoice=form-10&entryId=0",
    "?root=جوب&formChoice=form-10&entryId=x",
  ]) {
    assert.equal((await route.GET(get(query))).status, 400, query);
  }
  const invalid = await route.GET(get("?root=ab&formChoice=form-10"));
  assert.equal(invalid.status, 200);
  assert.deepEqual(await invalid.json(), { variants: [], current: null });
});

test("a variant option is labelled with its name, description and the verb it produces", () => {
  assert.equal(
    formatPatternVariantLabel({
      id: 1,
      variant: "interrogate",
      description: "hollow, strong inflection",
      note: null,
      sample: "اِسْتَجْوَبَ",
      isDefault: false,
    }),
    "interrogate (hollow, strong inflection): اِسْتَجْوَبَ",
  );
  assert.equal(
    formatPatternVariantLabel({ id: 1, variant: null, description: "", note: null, sample: null, isDefault: true }),
    "Default",
  );
});
