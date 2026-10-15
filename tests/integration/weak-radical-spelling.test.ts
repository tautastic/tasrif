import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  assertSqlState,
  collectSqlSources,
  findPattern,
  insertEntry,
  openDatabase,
  storedParadigm,
  storedStems,
} from "../harness";

const db = await openDatabase();
const soundFormI = await findPattern(db, 1, "a ~ u");

const FATHA = String.fromCodePoint(0x064e);
const HAMZA_ABOVE = String.fromCodePoint(0x0654);

const resolve = (root: string, perfect: string, imperfect: string): Promise<number | null> =>
  db.scalar<number | null>("SELECT resolve_morph_pattern_id($1, 1, $2::short_vowel, $3::short_vowel)", [
    root,
    perfect,
    imperfect,
  ]);

const FOLDED_ROOTS: [string, string, string][] = [
  ["a final alef maksura", "رمى", "رمي"],
  ["an initial alef maksura", "ىسر", "يسر"],
  ["a middle alef maksura", "حىي", "حيي"],
  ["spaces between the radicals", "ر م ى", "رمي"],
  ["vowel marks", `ر${FATHA}م${FATHA}ى`, "رمي"],
  ["a root already written with ya", "رمي", "رمي"],
];

for (const [label, written, folded] of FOLDED_ROOTS) {
  test(`strip_root_noise writes ${label} as ya`, async () => {
    assert.equal(await db.scalar<string>("SELECT strip_root_noise($1)", [written]), folded);
  });
}

test("strip_root_noise leaves a bare alef and a teh marbuta alone so that only the verb check refuses them", async () => {
  assert.equal(await db.scalar<string>("SELECT strip_root_noise($1)", ["دعا"]), "دعا");
  assert.equal(await db.scalar<string>("SELECT strip_root_noise($1)", ["رحمة"]), "رحمة");
});

test("strip_root_noise composes a decomposed hamza instead of dropping it", async () => {
  assert.equal(await db.scalar<string>("SELECT strip_root_noise($1)", [`ا${HAMZA_ABOVE}كل`]), "أكل");
});

test("a root written with alef maksura classifies exactly like the same root written with ya", async () => {
  for (const [, written, folded] of FOLDED_ROOTS) {
    const classify = (root: string) => db.one<Record<string, unknown>>("SELECT (classify_root($1)).*", [root]);
    assert.deepEqual(await classify(written), await classify(folded), written);
  }
  const shape = await db.one<{ radical1: string; radical3: string }>("SELECT (classify_root($1)).*", ["رمى"]);
  assert.equal(shape.radical3, "ya");
});

test("a root written with alef maksura resolves the same pattern as the same root written with ya", async () => {
  const written = await resolve("رمى", "a", "i");
  assert.notEqual(written, null);
  assert.equal(written, await resolve("رمي", "a", "i"));
});

test("require_triliteral_root returns the folded root", async () => {
  assert.equal(await db.scalar<string>("SELECT require_triliteral_root($1)", ["رمى"]), "رمي");
});

test("require_triliteral_root refuses a bare alef and says how to write the radical", async () => {
  for (const root of ["دعا", "ا ك ل", "قال"]) {
    const failure = await db.failure("SELECT require_triliteral_root($1)", [root]);
    assertSqlState(failure, "22023", /contains alef.*write a weak radical as/);
    assert.ok(failure.message.includes(root), `the message echoes ${root}`);
  }
});

test("the generators refuse a root that contains a bare alef", async () => {
  const failure = await db.failure("SELECT * FROM generate_conjugation_rows($1, $2::jsonb, 1)", [
    "دعا",
    JSON.stringify({ perfect: "{1}َ{2}َ{3}" }),
  ]);
  assertSqlState(failure, "22023", /contains alef/);
});

test("an entry with a pattern and a root written with alef maksura is stored and generated with ya", async () => {
  await db.tx(async (tx) => {
    const patternId = await resolve("رمى", "a", "i");
    assert.ok(patternId);
    const entryId = await insertEntry(tx, { text: "رَمَى", root: "رمى", morphPatternId: patternId });

    assert.equal(await tx.scalar<string>("SELECT root FROM lexical_entry WHERE id = $1", [entryId]), "رمي");
    assert.equal(await tx.scalar<string>("SELECT latin_root FROM lexical_entry WHERE id = $1", [entryId]), "rmy");
    const paradigm = await storedParadigm(tx, entryId);
    assertArabicEqual(paradigm.perfect?.third_person_masculine_singular ?? null, "رَمَى", "perfect 3ms");
    assertArabicEqual(paradigm.imperfect_indicative?.third_person_masculine_singular ?? null, "يَرْمِي", "imperfect");
    assertArabicEqual((await storedStems(tx, entryId)).active_participle, "رَامٍ", "active participle");
  });
});

test("an entry with a pattern is rejected when its root contains a bare alef", async () => {
  await db.tx(async (tx) => {
    const failure = await tx.failure(
      "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', $1, $2, $3)",
      ["دَعَا", "دعا", soundFormI.id],
    );
    assertSqlState(failure, "22023", /contains alef/);
  });
});

test("an entry without a pattern keeps a root that contains a bare alef", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "دُعَاء", root: "دعا" });
    assert.equal(await tx.scalar<string>("SELECT root FROM lexical_entry WHERE id = $1", [entryId]), "دعا");
  });
});

test("re-applying the spelling script folds legacy roots and leaves a bare alef for a human", async () => {
  const script = (await collectSqlSources()).find((source) => source.path.endsWith("0053_weak_radical_spelling.sql"));
  assert.ok(script, "db/0053_weak_radical_spelling.sql is part of the loaded schema");

  await db.tx(async (tx) => {
    await tx.exec("ALTER TABLE lexical_entry DISABLE TRIGGER trg_normalize_lexical_entry_root");
    const patternId = await resolve("رمي", "a", "i");
    assert.ok(patternId);
    const legacyVerb = await insertEntry(tx, { text: "رَمَى", root: "رمى", morphPatternId: patternId });
    const legacyNoun = await insertEntry(tx, { text: "مَرْمًى", root: "رمى" });
    const bareAlef = await insertEntry(tx, { text: "دُعَاء", root: "دعا" });
    await tx.exec("ALTER TABLE lexical_entry ENABLE TRIGGER trg_normalize_lexical_entry_root");

    const storedRoot = (entryId: number) =>
      tx.scalar<string>("SELECT root FROM lexical_entry WHERE id = $1", [entryId]);
    assert.equal(await storedRoot(legacyVerb), "رمى");

    await tx.exec(script.sql);

    assert.equal(await storedRoot(legacyVerb), "رمي");
    assert.equal(await storedRoot(legacyNoun), "رمي");
    assert.equal(await storedRoot(bareAlef), "دعا");
    assertArabicEqual((await storedStems(tx, legacyVerb)).active_participle, "رَامٍ", "stems follow the folded root");
  });
});
