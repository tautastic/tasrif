import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVerbFormChoice, type VerbFormChoice, verbFormChoices } from "~/lib/validation/verbFormChoice";
import { NO_PASSIVE_SWEEP_SHAPES, SWEEP_SHAPES, type SweepShape } from "../fixtures/sweep-roots.ts";
import {
  assertArabicEqual,
  assertParadigmEqual,
  conjugate,
  type Db,
  IMPERATIVE_PERSONS,
  insertEntry,
  MOODS,
  openDatabase,
  type Paradigm,
  PERSONS,
  storedParadigm,
  storedStems,
  type VerbalNouns,
  verbalNouns,
} from "../harness";

const db = await openDatabase();

const LETTER = /[ء-غف-ي]/u;
const MARK = /[ً-ْ]/u;
const ALEF = "ا";
const ALEF_MADDA = "آ";
const ALEF_MAKSURA = "ى";
const TEH_MARBUTA = "ة";
const WAW = "و";
const YEH = "ي";
const DAMMA = "ُ";
const KASRA = "ِ";
const SHADDA = "ّ";
const SUKUN = "ْ";
const HAMZA_ON_ALEF = "أ";
const HAMZA_SPELLINGS = ["ء", "ئ", "ؤ", "إ", "آ"];

interface Resolved {
  id: number;
  code: string;
  form_number: number;
  no_affix: boolean;
  rules: unknown;
}

const resolve = (scope: Db, root: string, choice: VerbFormChoice): Promise<Resolved | null> => {
  const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
  return scope.maybeOne<Resolved>(
    `SELECT id, code, form_number, no_affix, rules
     FROM morph_pattern
     WHERE id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)`,
    [root, formNumber, perfectVowel, imperfectVowel],
  );
};

const unvocalisedLetters = (form: string, allowBareFinal: boolean): string[] => {
  const chars = [...form];
  const problems: string[] = [];
  chars.forEach((char, index) => {
    if (!LETTER.test(char)) {
      return;
    }
    const next = chars[index + 1];
    const previous = chars[index - 1] === SHADDA ? chars[index - 2] : chars[index - 1];
    if (next !== undefined && MARK.test(next)) {
      return;
    }
    if (char === ALEF || char === ALEF_MADDA || char === ALEF_MAKSURA) {
      return;
    }
    if ((char === WAW && previous === DAMMA) || (char === YEH && previous === KASRA)) {
      return;
    }
    if (next === undefined && (allowBareFinal || char === TEH_MARBUTA)) {
      return;
    }
    problems.push(`${char} at ${index}`);
  });
  return problems;
};

const anomalies = (form: string, allowBareFinal: boolean): string[] => {
  const found: string[] = [];
  if (/\{\d+\}/u.test(form)) {
    found.push("placeholder residue");
  }
  if (/[ً-ِْ][ً-ِْ]/u.test(form)) {
    found.push("stacked vowel or sukun");
  }
  if (form.includes(SHADDA + SHADDA) || form.includes(SHADDA + SUKUN) || form.includes(SUKUN + SHADDA)) {
    found.push("doubled shadda or shadda with sukun");
  }
  if (/^[ً-ْ]/u.test(form)) {
    found.push("starts with a mark");
  }
  const letters = [...form].filter((char) => LETTER.test(char)).length;
  if (letters < 1 || letters > 11) {
    found.push(`letter count ${letters} outside 1..11`);
  }
  for (const problem of unvocalisedLetters(form, allowBareFinal)) {
    found.push(`unvocalised letter ${problem}`);
  }
  return found;
};

const checkParadigm = (label: string, paradigm: Paradigm, nouns: VerbalNouns): string[] => {
  const problems: string[] = [];
  for (const mood of MOODS) {
    const cells = paradigm[mood] ?? {};
    const expected = mood === "imperative" ? IMPERATIVE_PERSONS : PERSONS;
    const keys = Object.keys(cells).sort();
    if (keys.join(",") !== [...expected].sort().join(",")) {
      problems.push(`${label} ${mood}: persons ${keys.join(",")}`);
    }
    for (const [person, form] of Object.entries(cells)) {
      if (form === undefined) {
        continue;
      }
      for (const anomaly of anomalies(form, false)) {
        problems.push(`${label} ${mood}/${person} ${form}: ${anomaly}`);
      }
    }
  }
  for (const [key, form] of Object.entries(nouns)) {
    if (form === null) {
      continue;
    }
    for (const anomaly of anomalies(form, true)) {
      problems.push(`${label} ${key} ${form}: ${anomaly}`);
    }
  }
  return problems;
};

const sweepShape = (shape: SweepShape) => {
  test(`${shape.shape}: every swept root is real data of that shape`, async () => {
    assert.equal(new Set(shape.roots).size, shape.roots.length, `${shape.shape} lists a root twice`);
    for (const root of shape.roots) {
      const classification = await db.one<{ r1: string; r2: string; r3: string; geminate: boolean }>(
        `SELECT (c).radical1::text AS r1, (c).radical2::text AS r2, (c).radical3::text AS r3, (c).is_geminate AS geminate
         FROM (SELECT classify_root($1) AS c) classified`,
        [root],
      );
      assert.deepEqual(
        {
          radical1: classification.r1,
          radical2: classification.r2,
          radical3: classification.r3,
          geminate: classification.geminate,
        },
        shape.classification,
        root,
      );
    }
  });

  test(`${shape.shape}: the documented verb form choices resolve for every swept root`, async () => {
    for (const root of shape.roots) {
      for (const choice of shape.choices) {
        assert.ok(await resolve(db, root, choice), `${root} ${choice} does not resolve`);
      }
    }
  });

  test(`${shape.shape}: every resolving pattern gives a complete, well-formed paradigm for every swept root`, async () => {
    const problems: string[] = [];
    let checked = 0;
    for (const root of shape.roots) {
      for (const choice of verbFormChoices) {
        const resolved = await resolve(db, root, choice);
        if (!resolved) {
          continue;
        }
        checked += 1;
        const paradigm = await conjugate(db, root, resolved.id);
        const nouns = await verbalNouns(db, root, resolved.id);
        problems.push(...checkParadigm(`${root} ${choice} (${resolved.code})`, paradigm, nouns));
      }
    }
    assert.ok(checked >= shape.roots.length * shape.choices.length, `${shape.shape}: only ${checked} paradigms swept`);
    assert.deepEqual(problems.slice(0, 40), [], `${problems.length} problem(s)`);
  });

  test(`${shape.shape}: a stored entry gets exactly the forms the pattern preview shows`, async () => {
    for (const root of shape.roots) {
      for (const choice of shape.choices) {
        await db.tx(async (tx) => {
          const resolved = await resolve(tx, root, choice);
          assert.ok(resolved);
          const entryId = await insertEntry(tx, { text: `${root} ${choice}`, root, morphPatternId: resolved.id });
          const stored = await storedParadigm(tx, entryId);
          const stems = await storedStems(tx, entryId);
          const preview = await previewParadigm(tx, root, resolved);
          const previewNouns = await previewVerbalNouns(tx, root, resolved);
          for (const mood of MOODS) {
            assertParadigmEqual(stored[mood] ?? {}, preview[mood] ?? {}, `${root} ${choice} ${mood}`);
          }
          assertArabicEqual(stems.masdar, previewNouns.masdar, `${root} ${choice} masdar`);
          assertArabicEqual(
            stems.active_participle,
            previewNouns.active_participle,
            `${root} ${choice} active participle`,
          );
          assertArabicEqual(
            stems.passive_participle,
            previewNouns.passive_participle,
            `${root} ${choice} passive participle`,
          );
        });
      }
    }
  });
};

const previewParadigm = async (scope: Db, root: string, resolved: Resolved): Promise<Paradigm> => {
  const rows = await scope.rows<{ mood: (typeof MOODS)[number]; person: (typeof PERSONS)[number]; form: string }>(
    `SELECT cr.mood::text AS mood, kv.key AS person, kv.value AS form
     FROM generate_conjugation_rows($1, $2::jsonb, $3::int, '{}'::jsonb, $4::boolean) cr,
          LATERAL jsonb_each_text(cr.person_forms) kv`,
    [root, JSON.stringify(resolved.rules), resolved.form_number, resolved.no_affix],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

const previewVerbalNouns = (scope: Db, root: string, resolved: Resolved): Promise<VerbalNouns> =>
  scope.one<VerbalNouns>(
    `SELECT vn.masdar, vn.active_participle, vn.passive_participle
     FROM generate_verbal_nouns($1, $2::jsonb, $3::int, '{}'::jsonb, FALSE) vn`,
    [root, JSON.stringify(resolved.rules), resolved.form_number],
  );

for (const shape of [...SWEEP_SHAPES, ...NO_PASSIVE_SWEEP_SHAPES]) {
  sweepShape(shape);
}

test("a hamza radical gives the same paradigm whichever letter carries it when the root is typed", async () => {
  const hamzated = [...SWEEP_SHAPES, ...NO_PASSIVE_SWEEP_SHAPES].filter((shape) =>
    [shape.classification.radical1, shape.classification.radical2, shape.classification.radical3].includes("hamza"),
  );
  assert.ok(hamzated.length > 0);
  for (const shape of hamzated) {
    for (const root of shape.roots) {
      assert.ok(root.includes(HAMZA_ON_ALEF), root);
      for (const spelling of HAMZA_SPELLINGS) {
        const respelt = root.replaceAll(HAMZA_ON_ALEF, spelling);
        for (const choice of shape.choices) {
          const onAlef = await resolve(db, root, choice);
          const other = await resolve(db, respelt, choice);
          assert.ok(onAlef && other, `${root} / ${respelt} ${choice}`);
          assert.equal(other.code, onAlef.code, `${respelt} ${choice} resolves differently from ${root}`);
          const left = await conjugate(db, root, onAlef.id);
          const right = await conjugate(db, respelt, other.id);
          for (const mood of MOODS) {
            assertParadigmEqual(right[mood] ?? {}, left[mood] ?? {}, `${respelt} vs ${root} ${choice} ${mood}`);
          }
          const leftNouns = await verbalNouns(db, root, onAlef.id);
          const rightNouns = await verbalNouns(db, respelt, other.id);
          assert.deepEqual(rightNouns, leftNouns, `${respelt} vs ${root} ${choice} verbal nouns`);
        }
      }
    }
  }
});
