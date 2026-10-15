import assert from "node:assert/strict";
import { test } from "node:test";
import "./next-runtime.ts";
import { openRepository } from "./repository-db.ts";
import { setRequestScope } from "./stubs/next-headers.ts";

const { sql, patterns, entries } = await openRepository();

const session = await import("~/server/auth/session");
const verbForm = await import("~/app/api/verb-form/resolve/route");
const entryActions = await import("~/server/actions/lexical-entry");
const patternActions = await import("~/server/actions/morph-pattern");

const ORIGIN = "http://localhost:3000";

const asAdmin = async () =>
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: await session.createSessionToken() } });

const verbResponse = async (query: string) => {
  const response = await verbForm.GET(new Request(`${ORIGIN}/api/verb-form/resolve${query}`));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const expectFailure = (result: { ok: boolean; error?: string }, pattern: RegExp) => {
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", pattern);
};

const sense = {
  pos: "verb" as const,
  senseNumber: 1,
  definitions: ["to translate"],
  examples: [],
  translations: [],
  relatedSenses: [],
};

const verbEntry = (text: string, root: string, verbFormChoice: string) => ({
  language: "ar" as const,
  text,
  root,
  verbFormChoice,
  senses: [sense],
  isVerified: true,
  morphologyOverrides: { no_passive: false },
});

const q = encodeURIComponent;

test("the verb form resolver describes a four-letter root as quadriliteral and finds the pattern of a quadriliteral choice", async () => {
  await asAdmin();
  const described = await verbResponse(`?root=${q("دحرج")}`);
  assert.equal(described.status, 200);
  assert.deepEqual(described.body, { classification: ["quadriliteral"], rootError: null, pattern: null });

  const resolved = await verbResponse(`?root=${q("زلزل")}&formChoice=form-2q`);
  assert.equal(resolved.status, 200);
  assert.deepEqual(resolved.body.classification, ["quadriliteral", "reduplicated"]);
  assert.equal((resolved.body.pattern as { description: string }).description, "quadriliteral");

  for (const choice of ["form-1q", "form-3q", "form-4q"]) {
    const result = await verbResponse(`?root=${q("هرول")}&formChoice=${choice}`);
    assert.equal(typeof (result.body.pattern as { id: number }).id, "number", choice);
  }
});

test("the verb form resolver explains a root whose length does not match the chosen form", async () => {
  await asAdmin();
  const triliteralOnQuad = await verbResponse(`?root=${q("كتب")}&formChoice=form-1q`);
  assert.equal(triliteralOnQuad.status, 200);
  assert.equal(triliteralOnQuad.body.classification, null);
  assert.match(String(triliteralOnQuad.body.rootError), /must have exactly 4 radicals/);

  const quadOnTriliteral = await verbResponse(`?root=${q("دحرج")}&formChoice=form-1-a-u`);
  assert.equal(quadOnTriliteral.body.classification, null);
  assert.match(String(quadOnTriliteral.body.rootError), /must have exactly 3 radicals/);

  assert.deepEqual(await verbResponse(`?root=${q("كتب")}&formChoice=form-5q`), {
    status: 400,
    body: { error: "Invalid parameters" },
  });
});

test("a final-weak quadriliteral root is described as such and has a pattern in form IIIq only", async () => {
  await asAdmin();
  const resolved = await verbResponse(`?root=${q("سلقى")}&formChoice=form-3q`);
  assert.deepEqual(resolved.body.classification, ["quadriliteral", "final-weak"]);
  assert.equal(resolved.body.rootError, null);
  assert.equal((resolved.body.pattern as { description: string }).description, "quadriliteral final-weak");

  for (const choice of ["form-1q", "form-2q", "form-4q"]) {
    const result = await verbResponse(`?root=${q("سلقى")}&formChoice=${choice}`);
    assert.deepEqual(result.body, { classification: ["quadriliteral", "final-weak"], rootError: null, pattern: null });
  }

  const waw = await verbResponse(`?root=${q("سلقو")}&formChoice=form-3q`);
  assert.deepEqual(waw.body, { classification: ["quadriliteral", "final-weak"], rootError: null, pattern: null });
});

test("a quadriliteral entry is created with its derived forms and listed under its own form", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(verbEntry("تَرْجَمَ", "ترجم", "form-1q") as never);
  assert.ok(created.ok);
  const stored = await sql.one<{
    masdar: string;
    active_participle: string;
    latin_root: string;
    radical_count: number;
  }>(
    `SELECT le.masdar, le.active_participle, le.latin_root, mp.radical_count
     FROM lexical_entry le JOIN morph_pattern mp ON mp.id = le.morph_pattern_id WHERE le.id = $1`,
    [created.data.id],
  );
  assert.equal(stored.radical_count, 4);
  assert.equal(stored.masdar.normalize("NFC"), "تَرْجَمَة".normalize("NFC"));
  assert.equal(stored.active_participle.normalize("NFC"), "مُتَرْجِم".normalize("NFC"));
  assert.equal(stored.latin_root, "trjm");
  assert.equal(
    await sql.scalar<number>("SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = $1", [created.data.id]),
    109,
  );

  const second = await entryActions.createLexicalEntryAction(verbEntry("كَتَبَ", "كتب", "form-1-a-u") as never);
  assert.ok(second.ok);
  const forms = await patterns.getVerbFormsWithCounts();
  assert.deepEqual(forms, [
    { formNumber: 1, total: 1 },
    { formNumber: 1, radicalCount: 4, total: 1 },
  ]);

  const quadList = await entries.getLexicalEntriesByFormNumber({ formNumber: 1, radicalCount: 4, page: 1, limit: 10 });
  assert.deepEqual(
    quadList.items.map((item) => item.text),
    ["تَرْجَمَ"],
  );
  assert.equal(quadList.total, 1);
  const triliteralList = await entries.getLexicalEntriesByFormNumber({ formNumber: 1, page: 1, limit: 10 });
  assert.deepEqual(
    triliteralList.items.map((item) => item.text),
    ["كَتَبَ"],
  );
  assert.equal(triliteralList.total, 1);
});

test("a quadriliteral entry is edited into another quadriliteral form and the edit page finds its choice", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(verbEntry("دَحْرَجَ", "دحرج", "form-1q") as never);
  assert.ok(created.ok);
  const updated = await entryActions.updateLexicalEntryAction({
    ...verbEntry("تَدَحْرَجَ", "دحرج", "form-2q"),
    id: created.data.id,
    senses: [
      { ...sense, id: await sql.scalar<number>("SELECT id FROM sense WHERE lexical_entry_id = $1", [created.data.id]) },
    ],
  } as never);
  assert.ok(updated.ok);
  const edit = await entries.getLexicalEntryForEdit(created.data.id);
  assert.deepEqual(edit?.morphPattern, { formNumber: 2, radicalCount: 4, perfectVowel: null, imperfectVowel: null });
  const { findVerbFormChoice } = await import("~/lib/validation/verbFormChoice");
  assert.ok(edit?.morphPattern);
  assert.equal(findVerbFormChoice(edit.morphPattern), "form-2q");
  const masdar = await sql.scalar<string>("SELECT masdar FROM lexical_entry WHERE id = $1", [created.data.id]);
  assert.equal(masdar.normalize("NFC"), "تَدَحْرُج".normalize("NFC"));
});

test("the action refuses a root of the wrong length and a final-weak root without a pattern", async () => {
  await asAdmin();
  expectFailure(
    await entryActions.createLexicalEntryAction(verbEntry("تَرْجَمَ", "كتب", "form-1q") as never),
    /^Invalid entry data — root: A quadriliteral verb root must have exactly 4 letters$/,
  );
  expectFailure(
    await entryActions.createLexicalEntryAction(verbEntry("تَرْجَمَ", "ترجم", "form-1-a-u") as never),
    /^Invalid entry data — root: A verb root must have exactly 3 letters$/,
  );
  expectFailure(
    await entryActions.createLexicalEntryAction(verbEntry("اِسْلَنْقَى", "سلقي", "form-2q") as never),
    /^No morphological pattern is available yet for root 'سلقي' in Form IIq$/,
  );
  expectFailure(
    await entryActions.createLexicalEntryAction(verbEntry("اِسْلَنْقَى", "سلقو", "form-3q") as never),
    /^No morphological pattern is available yet for root 'سلقو' in Form IIIq$/,
  );
});

const quadPatternInput = (overrides: Record<string, unknown> = {}) => ({
  formNumber: 1,
  radicalCount: 4,
  vocalicTemplate: "فَعْلَقَ",
  description: "test only quadriliteral",
  rules: { perfect: "{1}ُ{2}ْ{3}ُ{4}", masdar: "{1}ُ{2}ْ{3}ُ{4}" },
  noAffix: false,
  isLexical: true,
  radical1Kind: "sound",
  radical2Kind: "sound",
  radical3Kind: "sound",
  isGeminate: false,
  perfectVowel: "u",
  imperfectVowel: "i",
  ...overrides,
});

test("a pattern for four radicals is created through the action and stored with its radical count", async () => {
  await asAdmin();
  const created = await patternActions.createMorphPatternAction(quadPatternInput() as never);
  assert.ok(created.ok);
  const stored = await patterns.getMorphPatternById(created.data.id);
  assert.equal(stored?.radicalCount, 4);
  assert.equal(stored?.radical4Kind, "sound");
  assert.equal(await sql.scalar<number>("SELECT radical_count FROM morph_pattern WHERE id = $1", [created.data.id]), 4);

  const weak = await patternActions.createMorphPatternAction(
    quadPatternInput({ description: "test only weak fourth", radical4Kind: "ya" }) as never,
  );
  assert.ok(weak.ok);
  assert.equal((await patterns.getMorphPatternById(weak.data.id))?.radical4Kind, "ya");
  expectFailure(
    await patternActions.createMorphPatternAction(
      quadPatternInput({ description: "test only hamza fourth", radical4Kind: "hamza" }) as never,
    ),
    /^Invalid pattern data — radical4Kind: A hamza as the last radical/,
  );

  expectFailure(
    await patternActions.createMorphPatternAction(quadPatternInput({ rules: { perfect: "{1}ُ{2}ْ{3}" } }) as never),
    /^Invalid pattern data — rules: A pattern for four radicals must use the fourth radical/,
  );
  expectFailure(
    await patternActions.createMorphPatternAction(
      quadPatternInput({ radicalCount: 3, description: "test only three" }) as never,
    ),
    /^Invalid pattern data — .*Unknown placeholder "\{4\}"/,
  );
});

test("a non-lexical pattern for four radicals that repeats a quadriliteral shape is refused, a triliteral one is not", async () => {
  await asAdmin();
  const duplicate = await patternActions.createMorphPatternAction(
    quadPatternInput({
      isLexical: false,
      formNumber: 2,
      perfectVowel: null,
      imperfectVowel: null,
      description: "twin",
    }) as never,
  );
  expectFailure(
    duplicate,
    /^Pattern #\d+ \("quadriliteral"\) already matches this exact root shape and vowel combination/,
  );

  expectFailure(
    await patternActions.createMorphPatternAction(
      quadPatternInput({
        isLexical: false,
        formNumber: 3,
        perfectVowel: null,
        imperfectVowel: null,
        description: "twin final weak",
        radical4Kind: "ya",
      }) as never,
    ),
    /^Pattern #\d+ \("quadriliteral final-weak"\) already matches this exact root shape and vowel combination/,
  );

  const triliteralKey = await patterns.findAmbiguousPattern({
    formNumber: 2,
    radical1Kind: "sound",
    radical2Kind: "sound",
    radical3Kind: "sound",
    isGeminate: false,
    perfectVowel: null,
    imperfectVowel: null,
  });
  const quadKey = await patterns.findAmbiguousPattern({
    formNumber: 2,
    radicalCount: 4,
    radical1Kind: "sound",
    radical2Kind: "sound",
    radical3Kind: "sound",
    isGeminate: false,
    perfectVowel: null,
    imperfectVowel: null,
  });
  assert.ok(triliteralKey && quadKey);
  assert.notEqual(triliteralKey.id, quadKey.id);
});

test("the pattern preview generates four-radical forms and refuses a root of the wrong length", async () => {
  await asAdmin();
  const rules = { perfect: "{1}َ{2}ْ{3}َ{4}", imperfect_stem: "{1}َ{2}ْ{3}ِ{4}", masdar: "{1}َ{2}ْ{3}َ{4}َة" };
  const preview = await patternActions.previewMorphPatternAction({
    root: "دحرج",
    rules,
    formNumber: 1,
    noAffix: false,
  });
  assert.ok(preview.ok);
  const cell = (mood: string, person: string) =>
    preview.data.conjugation.find((row) => row.mood === mood && row.person === person)?.form;
  assert.equal(cell("perfect", "third_person_masculine_singular")?.normalize("NFC"), "دَحْرَجَ".normalize("NFC"));
  assert.equal(
    cell("imperfect_indicative", "third_person_masculine_singular")?.normalize("NFC"),
    "يُدَحْرِجُ".normalize("NFC"),
  );
  assert.equal(preview.data.verbalNouns.masdar?.normalize("NFC"), "دَحْرَجَة".normalize("NFC"));

  expectFailure(
    await patternActions.previewMorphPatternAction({ root: "كتب", rules, formNumber: 1, noAffix: false }),
    /^Invalid preview input — root: Root must have exactly 4 letters$/,
  );
  expectFailure(
    await patternActions.previewMorphPatternAction({
      root: "دحرج",
      rules: { perfect: "{1}َ{2}َ{3}" },
      formNumber: 1,
      noAffix: false,
    }),
    /^Invalid preview input — root: Root must have exactly 3 letters$/,
  );
});

test("listing quadriliteral patterns in the admin keeps them with their form and tells them apart", async () => {
  const all = await patterns.listMorphPatternsForAdmin({ lexicalFilter: "All", page: 1, limit: 1000 });
  const quad = await patterns.listMorphPatternsForAdmin({
    radicalCount: 4,
    lexicalFilter: "All",
    page: 1,
    limit: 1000,
  });
  assert.ok(quad.items.length >= 4);
  assert.ok(quad.items.every((item) => item.radicalCount === 4));
  assert.ok(all.items.some((item) => item.radicalCount === 3));
  const quadFormOne = await patterns.listMorphPatternsForAdmin({
    formNumber: 1,
    radicalCount: 4,
    lexicalFilter: "Shape-resolved",
    page: 1,
    limit: 1000,
  });
  assert.deepEqual(
    quadFormOne.items.map((item) => item.description),
    ["quadriliteral"],
  );
});

test("a final-weak quadriliteral entry takes the final-weak pattern and stores its forms", async () => {
  await asAdmin();
  const created = await entryActions.createLexicalEntryAction(verbEntry("اِسْلَنْقَى", "سلقي", "form-3q") as never);
  assert.ok(created.ok);
  const stored = await sql.one<{ code: string; masdar: string; active_participle: string }>(
    `SELECT mp.code, le.masdar, le.active_participle
     FROM lexical_entry le JOIN morph_pattern mp ON mp.id = le.morph_pattern_id WHERE le.id = $1`,
    [created.data.id],
  );
  assert.equal(stored.code, "f3-quadriliteral-final-weak");
  assert.equal(stored.masdar.normalize("NFC"), "اِسْلِنْقَاء".normalize("NFC"));
  assert.equal(stored.active_participle.normalize("NFC"), "مُسْلَنْقٍ".normalize("NFC"));
  assert.equal(
    await sql.scalar<number>("SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = $1", [created.data.id]),
    57,
  );
  const first = await sql.scalar<string>(
    `SELECT form FROM conjugation
     WHERE lexical_entry_id = $1 AND mood = 'perfect' AND person = 'first_person_singular'`,
    [created.data.id],
  );
  assert.equal(first.normalize("NFC"), "اِسْلَنْقَيْتُ".normalize("NFC"));
});
