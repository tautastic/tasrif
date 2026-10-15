import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  assertSqlState,
  collectSqlSources,
  type Db,
  findPattern,
  insertEntry,
  openDatabase,
  storedParadigm,
  storedStems,
} from "../harness";

const db = await openDatabase();
const soundFormI = await findPattern(db, 1, "a ~ u");

const TATWEEL = "ـ";
const FATHA = "َ";
const ZWNJ = "‌";
const NBSP = " ";

const storedRoot = (scope: Db, entryId: number): Promise<string | null> =>
  scope.scalar<string | null>("SELECT root FROM lexical_entry WHERE id = $1", [entryId]);

const conjugationIds = (scope: Db, entryId: number): Promise<number[]> =>
  scope.column<number>("SELECT id FROM conjugation WHERE lexical_entry_id = $1 ORDER BY id", [entryId]);

const NOISY_ROOTS: [string, string][] = [
  ["spaces between the radicals", "ك ت ب"],
  ["a leading space", " كتب"],
  ["a trailing space", "كتب "],
  ["hyphens between the radicals", "ك-ت-ب"],
  ["vowel marks", `ك${FATHA}ت${FATHA}ب${FATHA}`],
  ["tatweel", `ك${TATWEEL}ت${TATWEEL}ب`],
  ["a zero width non-joiner", `ك${ZWNJ}تب`],
  ["a no-break space", `ك${NBSP}تب`],
];

for (const [label, noisy] of NOISY_ROOTS) {
  test(`a root with ${label} is stored clean and generates the same stems as the clean root`, async () => {
    await db.tx(async (tx) => {
      const entryId = await insertEntry(tx, { text: "كَتَبَ", root: noisy, morphPatternId: soundFormI.id });

      assert.equal(await storedRoot(tx, entryId), "كتب");
      assert.equal(
        await tx.scalar<string | null>("SELECT latin_root FROM lexical_entry WHERE id = $1", [entryId]),
        "ktb",
      );
      const stems = await storedStems(tx, entryId);
      assertArabicEqual(stems.masdar, "كَتْب", "masdar");
      assertArabicEqual(stems.active_participle, "كَاتِب", "active participle");
      assertArabicEqual(stems.passive_participle, "مَكْتُوب", "passive participle");
      const paradigm = await storedParadigm(tx, entryId);
      assertArabicEqual(paradigm.perfect?.third_person_masculine_singular ?? null, "كَتَبَ", "perfect 3ms");
      assertArabicEqual(paradigm.imperfect_indicative?.third_person_masculine_singular ?? null, "يَكْتُبُ", "imperfect");
    });
  });
}

test("updating a root to a noisy spelling of the same root regenerates nothing", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const before = await conjugationIds(tx, entryId);

    await tx.exec("UPDATE lexical_entry SET root = $2 WHERE id = $1", [entryId, " ك ت ب "]);

    assert.equal(await storedRoot(tx, entryId), "كتب");
    assert.deepEqual(await conjugationIds(tx, entryId), before);
  });
});

test("a root that is only noise is stored as NULL", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "  - ", morphPatternId: soundFormI.id });

    assert.equal(await storedRoot(tx, entryId), null);
    assert.equal((await storedStems(tx, entryId)).masdar, null);
  });
});

test("a four-letter root is rejected when a pattern is attached", async () => {
  await db.tx(async (tx) => {
    const failure = await tx.failure(
      "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', $1, $2, $3)",
      ["تَرْجَمَ", "ترجم", soundFormI.id],
    );
    assertSqlState(failure, "22023", /root 'ترجم' must have exactly 3 radicals.*found 4/);
  });
});

test("a two-letter root is rejected when a pattern is attached", async () => {
  await db.tx(async (tx) => {
    const failure = await tx.failure(
      "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', $1, $2, $3)",
      ["كَتَ", "كت", soundFormI.id],
    );
    assertSqlState(failure, "22023", /exactly 3 radicals/);
  });
});

test("the radical count is checked after normalization, not on the raw string", async () => {
  await db.tx(async (tx) => {
    const failure = await tx.failure(
      "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', $1, $2, $3)",
      ["تَرْجَمَ", "ت ر ج م", soundFormI.id],
    );
    assertSqlState(failure, "22023", /found 4/);
  });
});

test("attaching a pattern to an entry whose root is not triliteral is rejected", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "ترجم" });
    assert.equal(await storedRoot(tx, entryId), "ترجم");

    const failure = await tx.failure("UPDATE lexical_entry SET morph_pattern_id = $2 WHERE id = $1", [
      entryId,
      soundFormI.id,
    ]);
    assertSqlState(failure, "22023");
  });
});

test("a four-letter root is accepted while no pattern is attached", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "تَرْجَمَ", root: "تَرْجَم" });

    assert.equal(await storedRoot(tx, entryId), "ترجم");
    assert.equal((await storedStems(tx, entryId)).masdar, null);
  });
});

test("an entry with a pattern but no root is still allowed and carries no derived data", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", morphPatternId: soundFormI.id });

    assert.equal((await storedStems(tx, entryId)).masdar, null);
    assert.deepEqual(await conjugationIds(tx, entryId), []);
  });
});

test("the generators accept a noisy root and refuse one that is not triliteral", async () => {
  const nouns = (root: string) =>
    db.one<{ masdar: string }>("SELECT vn.masdar FROM generate_verbal_nouns($1, $2::jsonb, 1) vn", [
      root,
      JSON.stringify({ masdar: "{1}َ{2}ْ{3}" }),
    ]);

  assertArabicEqual((await nouns("ك ت ب")).masdar, "كَتْب", "noisy root");

  const tooLong = await db.failure("SELECT * FROM generate_verbal_nouns($1, $2::jsonb, 1)", [
    "ترجم",
    JSON.stringify({ masdar: "{1}َ{2}ْ{3}" }),
  ]);
  assertSqlState(tooLong, "22023", /exactly 3 radicals/);

  const tooShort = await db.failure("SELECT * FROM generate_conjugation_rows($1, $2::jsonb, 1)", [
    "كت",
    JSON.stringify({ perfect: "{1}َ{2}َ{3}" }),
  ]);
  assertSqlState(tooShort, "22023", /exactly 3 radicals/);

  const missing = await db.failure("SELECT * FROM generate_conjugation_rows(NULL, $1::jsonb, 1)", [
    JSON.stringify({ perfect: "{1}َ{2}َ{3}" }),
  ]);
  assertSqlState(missing, "22023", /exactly 3 radicals/);
});

test("require_triliteral_root returns the cleaned root", async () => {
  assert.equal(await db.scalar<string>("SELECT require_triliteral_root($1)", [" ك-ت ب "]), "كتب");
  assertSqlState(await db.failure("SELECT require_triliteral_root($1)", ["كتبب"]), "22023");
});

test("lexical_pattern_override roots are stored clean and resolve from a noisy root", async () => {
  await db.tx(async (tx) => {
    await tx.exec(
      `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id)
       VALUES ($1, 1, 'a', 'u', $2)`,
      [` ك${FATHA} ت ب`, soundFormI.id],
    );

    assert.equal(
      await tx.scalar<string>("SELECT root FROM lexical_pattern_override WHERE morph_pattern_id = $1 AND root = $2", [
        soundFormI.id,
        "كتب",
      ]),
      "كتب",
    );
    assert.equal(await tx.scalar<number>("SELECT resolve_morph_pattern_id($1, 1, 'a', 'u')", ["ك ت ب"]), soundFormI.id);

    const duplicate = await tx.failure(
      `INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id)
       VALUES ($1, 1, 'a', 'u', $2)`,
      ["كتب", soundFormI.id],
    );
    assertSqlState(duplicate, "23505");
  });
});

test("re-applying the repair script normalises legacy roots and leaves unfixable ones for a human", async () => {
  const script = (await collectSqlSources()).find((source) => source.path.endsWith("0010_normalize_roots.sql"));
  assert.ok(script, "db/0010_normalize_roots.sql is part of the loaded schema");

  await db.tx(async (tx) => {
    await tx.exec("ALTER TABLE lexical_entry DISABLE TRIGGER trg_normalize_lexical_entry_root");
    const legacyNoun = await insertEntry(tx, { text: "كِتَاب", root: " ك ت ب " });
    const legacyVerb = await insertEntry(tx, { text: "كَتَبَ", root: "ك ت ب", morphPatternId: soundFormI.id });
    const unfixable = await insertEntry(tx, { text: "دَرَسَ", root: "د ر س ي", morphPatternId: soundFormI.id });
    await tx.exec("ALTER TABLE lexical_entry ENABLE TRIGGER trg_normalize_lexical_entry_root");

    assert.equal(await storedRoot(tx, legacyNoun), " ك ت ب ");

    await tx.exec(script.sql);

    assert.equal(await storedRoot(tx, legacyNoun), "كتب");
    assert.equal(await storedRoot(tx, legacyVerb), "كتب");
    assert.equal(await storedRoot(tx, unfixable), "د ر س ي", "left alone so the script cannot fail on it");
    assertArabicEqual((await storedStems(tx, legacyVerb)).masdar, "كَتْب", "stems follow the repaired root");
    assert.equal((await storedStems(tx, unfixable)).masdar, null, "no garbage stems for the unfixable root");
  });
});
