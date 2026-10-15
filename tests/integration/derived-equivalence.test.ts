import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { assertGolden, type Db, openDatabase } from "../harness";

const db = await openDatabase();

const SOUND_ROOTS = ["كتب", "ضرب", "سكن"];
const WEAK_ROOTS = ["أكل", "سأل", "قرأ", "وعد", "يسر", "مدد"];
const FORM_VIII_ASSIMILATION_ROOTS = ["صبر", "زهر", "ذكر", "درس", "ثبت", "طلب", "ظلم", "وصل"];

const CORPUS_ROOTS: Record<string, string[]> = {
  "f1-a-u": [...SOUND_ROOTS, ...WEAK_ROOTS],
  "f1-a-a": [...SOUND_ROOTS, ...WEAK_ROOTS],
  "f1-a-i": SOUND_ROOTS,
  "f1-i-i": SOUND_ROOTS,
  "f1-i-a": SOUND_ROOTS,
  "f1-u-u": SOUND_ROOTS,
  "f1-a-u-hollow-waw": ["قول"],
  "f1-a-i-hollow-ya": ["بيع"],
  "f1-a-a-final-weak": ["رمي"],
  "f1-a-a-final-weak-hamzated-middle": ["نأي"],
  "f1-a-a-final-weak-hamzated-middle-hamza-elided": ["رأي"],
  "f1-a-i-geminate": ["مدد"],
  f2: [...SOUND_ROOTS, ...WEAK_ROOTS],
  f3: SOUND_ROOTS,
  f4: [...SOUND_ROOTS, ...WEAK_ROOTS],
  "f4-final-weak-ya": ["رمي"],
  "f4-final-weak-waw": ["دعو"],
  f5: SOUND_ROOTS,
  f6: SOUND_ROOTS,
  f7: SOUND_ROOTS,
  f8: [...SOUND_ROOTS, ...FORM_VIII_ASSIMILATION_ROOTS],
  "f8-final-weak-ya": ["رمي"],
  "f8-final-weak-waw": ["دعو"],
  f9: SOUND_ROOTS,
  f10: [...SOUND_ROOTS, ...WEAK_ROOTS],
  "f10-final-weak-ya": ["رمي"],
  "f10-final-weak-waw": ["دعو"],
  "f10-hollow-waw": ["قول"],
};

interface CorpusEntry {
  language: "ar" | "en";
  text: string;
  root: string | null;
  code: string | null;
  overrides: Record<string, string | boolean> | null;
}

const OVERRIDE_VARIANTS: [label: string, overrides: Record<string, string | boolean>][] = [
  ["masdar", { masdar_override: "كِتَابَة" }],
  ["active", { active_participle_override: "كَتَّاب" }],
  ["passive", { passive_participle_override: "مَكْتُوبَة" }],
  ["no-passive", { no_passive: true }],
  ["all", { masdar_override: "كِتَابَة", active_participle_override: "كَتَّاب", no_passive: true }],
];

const buildCorpus = (): CorpusEntry[] => {
  const entries: CorpusEntry[] = [];
  for (const [code, roots] of Object.entries(CORPUS_ROOTS)) {
    for (const root of roots) {
      entries.push({ language: "ar", text: `${root} ${code}`, root, code, overrides: null });
    }
  }
  for (const [label, overrides] of OVERRIDE_VARIANTS) {
    entries.push({ language: "ar", text: `كتب f1-a-u ${label}`, root: "كتب", code: "f1-a-u", overrides });
    entries.push({
      language: "ar",
      text: `رمي f8-final-weak-ya ${label}`,
      root: "رمي",
      code: "f8-final-weak-ya",
      overrides,
    });
  }
  entries.push({ language: "ar", text: "كِتَاب", root: "كتب", code: null, overrides: null });
  entries.push({ language: "ar", text: "بدون جذر f2", root: null, code: "f2", overrides: null });
  entries.push({ language: "en", text: "to write", root: null, code: null, overrides: null });
  entries.push({ language: "en", text: "running quickly", root: null, code: null, overrides: null });
  return entries;
};

const CORPUS = buildCorpus();

const insertCorpus = async (scope: Db): Promise<void> => {
  for (const entry of CORPUS) {
    await scope.exec(
      `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, morphology_overrides)
       VALUES ($1::lang_type, $2, $3,
               CASE WHEN $4::text IS NULL THEN NULL ELSE morph_pattern_id_for_code($4::text) END, $5::jsonb)`,
      [entry.language, entry.text, entry.root, entry.code, entry.overrides ? JSON.stringify(entry.overrides) : null],
    );
  }
};

interface DerivedRow {
  text: string;
  code: string | null;
  masdar: string | null;
  active_participle: string | null;
  passive_participle: string | null;
  search_vector: string | null;
  conjugations: unknown;
}

const byCodepoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const fingerprint = async (scope: Db): Promise<string[]> => {
  const rows = await scope.rows<DerivedRow>(
    `SELECT le.text, mp.code, le.masdar, le.active_participle, le.passive_participle,
            le.search_vector::text AS search_vector,
            COALESCE((SELECT jsonb_agg(jsonb_build_array(c.voice, c.mood, c.person, c.form)
                                       ORDER BY c.voice, c.mood, c.person)
                      FROM conjugation c WHERE c.lexical_entry_id = le.id), '[]'::jsonb) AS conjugations
     FROM lexical_entry le
     LEFT JOIN morph_pattern mp ON mp.id = le.morph_pattern_id`,
  );
  return rows
    .sort((left, right) => byCodepoint(left.text, right.text))
    .map((row) => {
      const digest = createHash("sha256")
        .update(
          JSON.stringify([
            row.masdar,
            row.active_participle,
            row.passive_participle,
            row.search_vector,
            row.conjugations,
          ]),
        )
        .digest("hex")
        .slice(0, 20);
      const rowCount = Array.isArray(row.conjugations) ? row.conjugations.length : 0;
      return `${row.text}\t${row.code ?? "-"}\t${rowCount}\t${digest}`;
    });
};

const render = (lines: string[]): string =>
  [
    "# Derived data of a fixed corpus, one line per entry: text, pattern code, conjugation rows, digest.",
    "# The digest covers masdar, both participles, search_vector and every conjugation row.",
    "# Built by tests/integration/derived-equivalence.test.ts; regenerate with UPDATE_GOLDENS=1 only when",
    "# generated output is meant to change, and say why in the commit.",
    "",
    ...lines,
    "",
    `total ${createHash("sha256").update(lines.join("\n")).digest("hex")}`,
    "",
  ].join("\n");

test("the corpus covers every pattern it names and every override", () => {
  assert.equal(new Set(CORPUS.map((entry) => entry.text)).size, CORPUS.length, "corpus texts must be unique");
  assert.ok(CORPUS.length >= 90, `corpus has ${CORPUS.length} entries`);
});

test("derived data of the fixed corpus matches its golden on every regeneration path", async () => {
  await db.tx(async (tx) => {
    await insertCorpus(tx);
    const inserted = await fingerprint(tx);
    await assertGolden("derived-corpus.txt", render(inserted));

    await tx.exec("SELECT regenerate_all_derived_stems()");
    assert.deepEqual(await fingerprint(tx), inserted, "regenerate_all_derived_stems");

    await tx.exec("CREATE TEMP TABLE saved_rules ON COMMIT DROP AS SELECT id, rules FROM morph_pattern");
    await tx.exec(`UPDATE morph_pattern SET rules = REPLACE(rules::text, U&'\\064E', U&'\\064F')::jsonb`);
    const mutated = await fingerprint(tx);
    const changed = mutated.filter((line, index) => line !== inserted[index]).length;
    assert.ok(changed >= 80, `a multi-row rules update should regenerate the entries of every pattern, ${changed}`);
    await tx.exec("UPDATE morph_pattern mp SET rules = s.rules FROM saved_rules s WHERE s.id = mp.id");
    assert.deepEqual(await fingerprint(tx), inserted, "rules changed and restored in multi-row updates");

    await tx.exec(
      `UPDATE morph_pattern
       SET rules = rules || jsonb_build_object('masdar', 'تَ' || (rules ->> 'masdar'))
       WHERE rules ? 'masdar'`,
    );
    const nounsMutated = await fingerprint(tx);
    const nounsChanged = nounsMutated.filter((line, index) => line !== inserted[index]).length;
    assert.ok(nounsChanged >= 80, `a masdar-only update should reach the entries of every pattern, ${nounsChanged}`);
    await tx.exec("UPDATE morph_pattern mp SET rules = s.rules FROM saved_rules s WHERE s.id = mp.id");
    assert.deepEqual(await fingerprint(tx), inserted, "verbal noun templates changed and restored");

    await tx.exec(
      `UPDATE morph_pattern
       SET rules = CASE
                     WHEN form_number % 2 = 0 AND rules ? 'active_participle'
                       THEN rules || jsonb_build_object('active_participle', 'مُ' || (rules ->> 'active_participle'))
                     ELSE REPLACE(rules::text, U&'\\064E', U&'\\0650')::jsonb
                     END`,
    );
    assert.notDeepEqual(await fingerprint(tx), inserted, "a mixed update changes derived data");
    await tx.exec("UPDATE morph_pattern mp SET rules = s.rules FROM saved_rules s WHERE s.id = mp.id");
    assert.deepEqual(await fingerprint(tx), inserted, "noun-only and conjugation changes in one statement, restored");

    for (const code of Object.keys(CORPUS_ROOTS)) {
      await tx.exec("UPDATE morph_pattern SET rules = rules, description = description || ' ' WHERE code = $1", [code]);
    }
    assert.deepEqual(await fingerprint(tx), inserted, "updates that do not change the output");

    await tx.exec(
      "CREATE TEMP TABLE saved_entries ON COMMIT DROP AS SELECT id, text, root, morphology_overrides FROM lexical_entry",
    );
    await tx.exec("UPDATE lexical_entry SET root = 'نصر' WHERE root IS NOT NULL");
    await tx.exec("UPDATE lexical_entry le SET root = s.root FROM saved_entries s WHERE s.id = le.id");
    assert.deepEqual(await fingerprint(tx), inserted, "roots changed and restored");

    await tx.exec(`UPDATE lexical_entry SET morphology_overrides = '{"no_passive": true}'::jsonb`);
    await tx.exec(
      "UPDATE lexical_entry le SET morphology_overrides = s.morphology_overrides FROM saved_entries s WHERE s.id = le.id",
    );
    assert.deepEqual(await fingerprint(tx), inserted, "overrides changed and restored");

    await tx.exec("UPDATE lexical_entry SET text = text || ' مؤقت'");
    await tx.exec("UPDATE lexical_entry le SET text = s.text FROM saved_entries s WHERE s.id = le.id");
    assert.deepEqual(await fingerprint(tx), inserted, "texts changed and restored");

    for (const id of await tx.column<number>("SELECT id FROM lexical_entry ORDER BY id")) {
      await tx.exec("SELECT regenerate_derived_stems_for_entry($1)", [id]);
    }
    assert.deepEqual(await fingerprint(tx), inserted, "regenerate_derived_stems_for_entry on every entry");
  });
});
