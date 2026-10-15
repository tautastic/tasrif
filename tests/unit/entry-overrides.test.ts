import assert from "node:assert/strict";
import { test } from "node:test";
import { entryCreateSchema, entryEditSchema } from "~/components/admin/entry-edit-form/schema";
import { MAX_OVERRIDE_LENGTH, parseMorphologyOverrides } from "~/lib/validation/morphology";
import { openRepository } from "./repository-db.ts";

const { sql, entries, patterns } = await openRepository();

const verbInput = (overrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  language: "ar" as const,
  text: "كَتَبَ",
  root: "كتب",
  verbFormChoice: "form-1-a-u" as const,
  senses: [
    {
      pos: "verb" as const,
      senseNumber: 1,
      definitions: ["to write"],
      examples: [],
      translations: [],
      relatedSenses: [],
    },
  ],
  morphologyOverrides: { no_passive: false, ...overrides },
  ...extra,
});

const persistable = async <T extends { root: string | null }>(parsed: T & { verbFormChoice: unknown }) => {
  const { verbFormChoice: _choice, ...rest } = parsed;
  const pattern = await patterns.resolveVerbMorphPattern(rest.root ?? "", "form-1-a-u");
  assert.ok(pattern, "a form I a~u pattern exists for the root");
  return { ...rest, morphPatternId: pattern.id };
};

const derived = (entryId: number) =>
  sql.rows<{ masdar: string | null; active_participle: string | null; passive_participle: string | null }>(
    "SELECT masdar, active_participle, passive_participle FROM lexical_entry WHERE id = $1",
    [entryId],
  );

const parseCreate = (input: ReturnType<typeof verbInput>) => {
  const result = entryCreateSchema.safeParse(input);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  return result.data;
};

const parseEdit = (id: number, input: ReturnType<typeof verbInput>) => {
  const result = entryEditSchema.safeParse({ ...input, id });
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  return result.data;
};

const GENERATED_ACTIVE = "كَاتِب";
const GENERATED_PASSIVE = "مَكْتُوب";

test("a saved entry without overrides gets the generated participles", async () => {
  const parsed = parseCreate(verbInput());
  assert.ok(parsed);
  const created = await entries.createLexicalEntry(await persistable(parsed));
  const [row] = await derived(created.id);
  assert.equal(row?.active_participle, GENERATED_ACTIVE);
  assert.equal(row?.passive_participle, GENERATED_PASSIVE);
});

test("setting the participle overrides changes the stored participles and clearing them restores the generated ones", async () => {
  const parsed = parseCreate(verbInput({}, { text: "كَتَبَ ٢" }));
  assert.ok(parsed);
  const created = await entries.createLexicalEntry(await persistable(parsed));

  const edit = async (overrides: Record<string, unknown>) => {
    const editParsed = parseEdit(created.id, verbInput(overrides, { text: "كَتَبَ ٢" }));
    assert.ok(editParsed);
    const updated = await entries.updateLexicalEntry({ ...(await persistable(editParsed)), id: created.id });
    assert.ok(updated);
    const [row] = await derived(created.id);
    assert.ok(row);
    return row;
  };

  const withActive = await edit({ active_participle_override: "  كَاتِبٌ  " });
  assert.equal(withActive.active_participle, "كَاتِبٌ");
  assert.equal(withActive.passive_participle, GENERATED_PASSIVE);

  const withBoth = await edit({
    active_participle_override: "كَاتِبٌ",
    passive_participle_override: "مَكْتُوبٌ",
  });
  assert.equal(withBoth.active_participle, "كَاتِبٌ");
  assert.equal(withBoth.passive_participle, "مَكْتُوبٌ");

  const stored = await sql.scalar<string>("SELECT morphology_overrides::text FROM lexical_entry WHERE id = $1", [
    created.id,
  ]);
  assert.deepEqual(JSON.parse(stored), {
    no_passive: false,
    active_participle_override: "كَاتِبٌ",
    passive_participle_override: "مَكْتُوبٌ",
  });

  const cleared = await edit({ active_participle_override: "", passive_participle_override: "   " });
  assert.equal(cleared.active_participle, GENERATED_ACTIVE);
  assert.equal(cleared.passive_participle, GENERATED_PASSIVE);
  const storedAfter = await sql.scalar<string>("SELECT morphology_overrides::text FROM lexical_entry WHERE id = $1", [
    created.id,
  ]);
  assert.deepEqual(JSON.parse(storedAfter), { no_passive: false });
});

test("the passive participle override is ignored while the entry has no passive", async () => {
  const parsed = parseCreate(verbInput({ no_passive: true, passive_participle_override: "مَكْتُوبٌ" }, { text: "كَتَبَ ٣" }));
  assert.ok(parsed);
  const created = await entries.createLexicalEntry(await persistable(parsed));
  const [row] = await derived(created.id);
  assert.equal(row?.passive_participle, null);
});

test("override text is trimmed and composed to NFC and empty strings disappear", () => {
  const decomposed = "آ";
  const parsed = parseCreate(
    verbInput({
      masdar_override: ` ${decomposed} `,
      active_participle_override: "",
      passive_participle_override: "   ",
    }),
  );
  assert.equal(parsed?.morphologyOverrides?.masdar_override, "آ");
  assert.equal("active_participle_override" in (parsed?.morphologyOverrides ?? {}), true);
  assert.equal(parsed?.morphologyOverrides?.active_participle_override, undefined);
  assert.equal(parsed?.morphologyOverrides?.passive_participle_override, undefined);
});

test("an override longer than the limit is rejected at its own path", () => {
  const tooLong = "ب".repeat(MAX_OVERRIDE_LENGTH + 1);
  for (const key of ["masdar_override", "active_participle_override", "passive_participle_override"]) {
    const result = entryCreateSchema.safeParse(verbInput({ [key]: tooLong }));
    assert.equal(result.success, false, key);
    const issue = result.error?.issues.find((candidate) => candidate.path.join(".") === `morphologyOverrides.${key}`);
    assert.ok(issue, key);
    assert.match(issue.message, /at most 100/);
  }
  assert.equal(
    entryCreateSchema.safeParse(verbInput({ active_participle_override: "ب".repeat(MAX_OVERRIDE_LENGTH) })).success,
    true,
  );
});

test("participle overrides on an Arabic entry must be in Arabic script", () => {
  for (const key of ["masdar_override", "active_participle_override", "passive_participle_override"]) {
    for (const bad of ["writer", "كاتب writer", "123", "كَاتِب!"]) {
      const result = entryCreateSchema.safeParse(verbInput({ [key]: bad }));
      assert.equal(result.success, false, `${key}: ${bad}`);
      assert.deepEqual(
        result.error?.issues.map((issue) => issue.path.join(".")),
        [`morphologyOverrides.${key}`],
        `${key}: ${bad}`,
      );
    }
    assert.equal(entryCreateSchema.safeParse(verbInput({ [key]: "كَاتِبٌ" })).success, true, key);
  }
});

test("an English entry may keep a Latin plural override", () => {
  const result = entryCreateSchema.safeParse({
    language: "en",
    text: "book",
    root: null,
    verbFormChoice: null,
    senses: [
      { pos: "noun", senseNumber: 1, definitions: ["a book"], examples: [], translations: [], relatedSenses: [] },
    ],
    morphologyOverrides: { plural_form: "books", no_passive: false },
  });
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  assert.equal(result.data?.morphologyOverrides?.plural_form, "books");
});

test("reading stored overrides keeps every valid field even when another one is corrupt", () => {
  const parsed = parseMorphologyOverrides({
    active_participle_override: "كَاتِبٌ",
    plural_form: 7,
    dual_form: "ب".repeat(MAX_OVERRIDE_LENGTH + 20),
    no_passive: "yes",
  });
  assert.equal(parsed.active_participle_override, "كَاتِبٌ");
  assert.equal(parsed.plural_form, undefined);
  assert.equal(parsed.dual_form?.length, MAX_OVERRIDE_LENGTH + 20);
  assert.equal(parsed.no_passive, false);
  assert.deepEqual(parseMorphologyOverrides(null), { no_passive: false });
  assert.deepEqual(parseMorphologyOverrides("text"), { no_passive: false });
});
