import { test } from "node:test";
import { assertArabicEqual, assertParadigmEqual, conjugate, findPattern, openDatabase, verbalNouns } from "../harness";

const db = await openDatabase();

// Same rules object as the seeded (form_number=1, description='a ~ u') row in
// db/0004_add_morphological_patterns.sql — kept in sync deliberately, since this test's whole
// point is to prove the *literal* jsonb codepath (used to preview an unsaved admin pattern)
// produces identical output to conjugating a persisted pattern with the same rules.
const FORM_I_A_U_RULES = {
  masdar: "{1}َ{2}ْ{3}",
  perfect: "{1}َ{2}َ{3}",
  imperative: "اُ{1}ْ{2}ُ{3}",
  imperfect_stem: "{1}ْ{2}ُ{3}",
  active_participle: "{1}َا{2}ِ{3}",
  passive_participle: "مَ{1}ْ{2}ُو{3}",
};

interface ConjugationRow {
  mood: string;
  person: string;
  form: string;
}

const previewConjugationSql = async (root: string) => {
  const rows = await db.rows<ConjugationRow>(
    `SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
     FROM generate_conjugation_rows($1, $2::jsonb, $3, '{}'::jsonb, $4) cr,
          LATERAL jsonb_each_text(cr.person_forms) kv`,
    [root, JSON.stringify(FORM_I_A_U_RULES), 1, false],
  );
  const paradigm: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

interface VerbalNounsRow {
  masdar: string | null;
  active_participle: string | null;
  passive_participle: string | null;
}

const previewVerbalNounsSql = (root: string): Promise<VerbalNounsRow> =>
  db.one<VerbalNounsRow>(
    `SELECT vn.masdar, vn.active_participle, vn.passive_participle
     FROM generate_verbal_nouns($1, $2::jsonb, $3, '{}'::jsonb, FALSE) vn`,
    [root, JSON.stringify(FORM_I_A_U_RULES), 1],
  );

test("previewing an unsaved pattern's literal rules matches conjugating the persisted pattern with the same rules", async () => {
  const persisted = await findPattern(db, 1, "a ~ u");
  const root = "كتب";

  const persistedParadigm = await conjugate(db, root, persisted.id);
  const previewParadigm = await previewConjugationSql(root);

  assertParadigmEqual(previewParadigm.perfect ?? {}, persistedParadigm.perfect ?? {}, "perfect");
  assertParadigmEqual(
    previewParadigm.imperfect_indicative ?? {},
    persistedParadigm.imperfect_indicative ?? {},
    "imperfect indicative",
  );
  assertParadigmEqual(previewParadigm.imperative ?? {}, persistedParadigm.imperative ?? {}, "imperative");
});

test("previewing an unsaved pattern's literal rules matches the persisted pattern's verbal nouns", async () => {
  const persisted = await findPattern(db, 1, "a ~ u");
  const root = "كتب";

  const persistedNouns = await verbalNouns(db, root, persisted.id);
  const previewNouns = await previewVerbalNounsSql(root);

  assertArabicEqual(previewNouns.masdar, persistedNouns.masdar, "masdar");
  assertArabicEqual(previewNouns.active_participle, persistedNouns.active_participle, "active participle");
  assertArabicEqual(previewNouns.passive_participle, persistedNouns.passive_participle, "passive participle");
});
