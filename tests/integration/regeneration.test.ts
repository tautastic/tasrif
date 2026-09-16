import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertArabicEqual,
  type Db,
  findPattern,
  insertEntry,
  openDatabase,
  storedParadigm,
  storedStems,
} from "../harness";

const db = await openDatabase();
const soundFormI = await findPattern(db, 1, "a ~ u");
const formII = await findPattern(db, 2, "");
const formIII = await findPattern(db, 3, "");

const conjugationCount = (scope: Db, entryId: number): Promise<string> =>
  scope.scalar<string>("SELECT count(*)::text FROM conjugation WHERE lexical_entry_id = $1", [entryId]);

const maxConjugationId = (scope: Db, entryId: number): Promise<string> =>
  scope.scalar<string>("SELECT COALESCE(max(id), 0)::text FROM conjugation WHERE lexical_entry_id = $1", [entryId]);

const countByMood = (scope: Db, entryId: number): Promise<{ mood: string; total: string }[]> =>
  scope.rows<{ mood: string; total: string }>(
    "SELECT mood::text AS mood, count(*)::text AS total FROM conjugation WHERE lexical_entry_id = $1 GROUP BY 1 ORDER BY 1",
    [entryId],
  );

const regenerate = (scope: Db, entryId: number): Promise<void> =>
  scope.exec("SELECT regenerate_derived_stems_for_entry($1)", [entryId]);

test("regenerate_derived_stems_for_entry is idempotent", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const original = await storedParadigm(tx, entryId);

    await regenerate(tx, entryId);
    await regenerate(tx, entryId);

    assert.deepEqual(await storedParadigm(tx, entryId), original);
    assert.equal(await conjugationCount(tx, entryId), "57");
    assertArabicEqual((await storedStems(tx, entryId)).masdar, "كَتْب", "masdar after two regenerations");
  });
});

test("regeneration replaces the conjugation rows instead of merging them", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const before = Number(await maxConjugationId(tx, entryId));

    await regenerate(tx, entryId);

    assert.ok(
      Number(await maxConjugationId(tx, entryId)) > before,
      "expected freshly inserted rows, which proves the DELETE ran and the unique constraint held",
    );
    assert.equal(await conjugationCount(tx, entryId), "57");
  });
});

test("regenerate_all_derived_stems repairs every entry, including ones without a pattern", async () => {
  await db.tx(async (tx) => {
    const verbId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const nounId = await insertEntry(tx, { language: "en", text: "book" });

    await tx.exec("UPDATE lexical_entry SET masdar = 'corrupted' WHERE id = ANY($1)", [`{${verbId},${nounId}}`]);
    await tx.exec("DELETE FROM conjugation WHERE lexical_entry_id = $1", [verbId]);
    assert.equal(await conjugationCount(tx, verbId), "0");

    await tx.exec("SELECT regenerate_all_derived_stems()");

    assertArabicEqual((await storedStems(tx, verbId)).masdar, "كَتْب", "verb masdar restored");
    assert.equal(await conjugationCount(tx, verbId), "57");
    assert.equal(
      (await storedStems(tx, nounId)).masdar,
      null,
      "entry without a pattern is cleared, not left corrupted",
    );
  });
});

test("updating morph_pattern.rules refreshes entries on that pattern and leaves the others alone", async () => {
  await db.tx(async (tx) => {
    const tracked = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });
    const untouched = await insertEntry(tx, { text: "كَاتَبَ", root: "كتب", morphPatternId: formIII.id });
    const untouchedBefore = await storedParadigm(tx, untouched);

    await tx.exec(`UPDATE morph_pattern SET rules = jsonb_set(rules, '{masdar}', '"{1}{2}{3}"'::jsonb) WHERE id = $1`, [
      soundFormI.id,
    ]);

    assertArabicEqual((await storedStems(tx, tracked)).masdar, "كتب", "masdar follows the edited template");
    assert.deepEqual(await storedParadigm(tx, untouched), untouchedBefore);
  });
});

test("updating morph_pattern.form_number re-resolves which affix rules apply", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَّبَ", root: "كتب", morphPatternId: formII.id });
    assert.deepEqual(await countByMood(tx, entryId), [
      { mood: "imperative", total: "5" },
      { mood: "imperfect_indicative", total: "13" },
      { mood: "imperfect_jussive", total: "13" },
      { mood: "imperfect_subjunctive", total: "13" },
      { mood: "perfect", total: "13" },
    ]);

    await tx.exec("UPDATE morph_pattern SET form_number = 11 WHERE id = $1", [formII.id]);

    assert.deepEqual(
      await countByMood(tx, entryId),
      [
        { mood: "imperative", total: "5" },
        { mood: "perfect", total: "13" },
      ],
      "no affix_rules exist for form 11, and perfect and imperative survive because they are looked up under form 0",
    );
  });
});

test("changing only no_affix propagates to the stored conjugations", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE morph_pattern SET no_affix = true WHERE id = $1", [soundFormI.id]);
    assert.equal(
      await conjugationCount(tx, entryId),
      "65",
      "trg_refresh_derived_stems_after_pattern_update fires on UPDATE OF rules, form_number, no_affix",
    );

    await regenerate(tx, entryId);
    assert.equal(await conjugationCount(tx, entryId), "65", "an explicit regeneration agrees with the trigger");
  });
});

test("a pattern whose rules are a JSON null clears the entry instead of raising", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE morph_pattern SET rules = 'null'::jsonb WHERE id = $1", [soundFormI.id]);

    assert.equal(await conjugationCount(tx, entryId), "0");
    const stems = await tx.one<{ masdar: string | null }>("SELECT masdar FROM lexical_entry WHERE id = $1", [entryId]);
    assert.equal(stems.masdar, null);
  });
});

test("regenerating an entry whose root became too short clears its derived data", async () => {
  await db.tx(async (tx) => {
    const entryId = await insertEntry(tx, { text: "كَتَبَ", root: "كتب", morphPatternId: soundFormI.id });

    await tx.exec("UPDATE lexical_entry SET root = 'كت' WHERE id = $1", [entryId]);
    await regenerate(tx, entryId);

    const stems = await storedStems(tx, entryId);
    assert.equal(stems.masdar, null);
    assert.equal(stems.active_participle, null);
    assert.equal(stems.passive_participle, null);
    assert.equal(await conjugationCount(tx, entryId), "0");
  });
});
