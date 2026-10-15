import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVerbFormChoice, type VerbFormChoice, verbFormChoices } from "~/lib/validation/verbFormChoice";
import { NO_PASSIVE_SWEEP_SHAPES, SWEEP_SHAPES } from "../fixtures/sweep-roots.ts";
import {
  assertParadigmEqual,
  conjugate,
  type Db,
  insertEntry,
  type Mood,
  openDatabase,
  type Paradigm,
  PERSONS,
} from "../harness";
import { passiveAnomalies, passiveParadigm } from "./passive-harness.ts";

const db = await openDatabase();

const PASSIVE_MOODS: Mood[] = ["perfect", "imperfect_indicative", "imperfect_subjunctive", "imperfect_jussive"];
const PREFIX_LETTERS = new Set(["ي", "ت", "أ", "ن"]);
const DAMMA = "ُ";
const HAMZA_ON_ALEF = "أ";
const HAMZA_SPELLINGS = ["ء", "ئ", "ؤ", "إ", "آ"];

interface Resolved {
  id: number;
  code: string;
  has_passive: boolean;
}

const resolve = (scope: Db, root: string, choice: VerbFormChoice): Promise<Resolved | null> => {
  const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
  return scope.maybeOne<Resolved>(
    `SELECT mp.id, mp.code, has_passive_rules(mp.rules) AS has_passive
     FROM morph_pattern mp
     WHERE mp.id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel)`,
    [root, formNumber, perfectVowel, imperfectVowel],
  );
};

const storedPassive = async (scope: Db, entryId: number): Promise<Paradigm> => {
  const rows = await scope.rows<{ mood: Mood; person: (typeof PERSONS)[number]; form: string }>(
    "SELECT mood::text AS mood, person::text AS person, form FROM conjugation WHERE lexical_entry_id = $1 AND voice = 'passive'",
    [entryId],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

const checkPassive = (label: string, passive: Paradigm, active: Paradigm): string[] => {
  const problems: string[] = [];
  const moods = Object.keys(passive).sort();
  if (moods.join(",") !== [...PASSIVE_MOODS].sort().join(",")) {
    problems.push(`${label}: moods ${moods.join(",")}`);
  }
  for (const mood of PASSIVE_MOODS) {
    const cells = passive[mood] ?? {};
    const keys = Object.keys(cells).sort();
    if (keys.join(",") !== [...PERSONS].sort().join(",")) {
      problems.push(`${label} ${mood}: persons ${keys.join(",")}`);
    }
    for (const [person, form] of Object.entries(cells)) {
      if (form === undefined) {
        continue;
      }
      for (const anomaly of passiveAnomalies(form)) {
        problems.push(`${label} ${mood}/${person} ${form}: ${anomaly}`);
      }
      if (mood !== "perfect" && !(PREFIX_LETTERS.has(form.charAt(0)) && form.charAt(1) === DAMMA)) {
        problems.push(`${label} ${mood}/${person} ${form}: the imperfect passive prefix does not carry damma`);
      }
    }
  }
  if (passive.perfect?.third_person_masculine_singular === active.perfect?.third_person_masculine_singular) {
    problems.push(`${label}: the passive perfect equals the active perfect`);
  }
  return problems;
};

for (const shape of SWEEP_SHAPES) {
  test(`${shape.shape}: every passive paradigm is complete, well formed and distinct from the active one`, async () => {
    const problems: string[] = [];
    let checked = 0;
    for (const root of shape.roots) {
      for (const choice of verbFormChoices) {
        const resolved = await resolve(db, root, choice);
        if (!resolved) {
          continue;
        }
        const passive = await passiveParadigm(db, root, resolved.id);
        if (!resolved.has_passive) {
          assert.deepEqual(passive, {}, `${root} ${choice} (${resolved.code}) has no passive rules`);
          continue;
        }
        checked += 1;
        problems.push(
          ...checkPassive(`${root} ${choice} (${resolved.code})`, passive, await conjugate(db, root, resolved.id)),
        );
      }
    }
    assert.ok(checked > 0, `${shape.shape}: no swept root reaches a pattern with a passive`);
    assert.deepEqual(problems.slice(0, 40), [], `${problems.length} problem(s)`);
  });

  test(`${shape.shape}: a stored entry gets exactly the passive forms the pattern preview computes`, async () => {
    for (const root of shape.roots) {
      for (const choice of shape.choices) {
        await db.tx(async (tx) => {
          const resolved = await resolve(tx, root, choice);
          assert.ok(resolved);
          const entryId = await insertEntry(tx, { text: `${root} ${choice}`, root, morphPatternId: resolved.id });
          const stored = await storedPassive(tx, entryId);
          const preview = await passiveParadigm(tx, root, resolved.id);
          for (const mood of PASSIVE_MOODS) {
            assertParadigmEqual(stored[mood] ?? {}, preview[mood] ?? {}, `${root} ${choice} ${mood}`);
          }
        });
      }
    }
  });
}

for (const shape of NO_PASSIVE_SWEEP_SHAPES) {
  test(`${shape.shape}: no pattern the shape reaches has passive rules, so no passive is generated or stored`, async () => {
    let reached = 0;
    for (const root of shape.roots) {
      for (const choice of verbFormChoices) {
        const resolved = await resolve(db, root, choice);
        if (!resolved) {
          continue;
        }
        reached += 1;
        assert.equal(resolved.has_passive, false, `${root} ${choice} (${resolved.code}) carries passive rules`);
        assert.deepEqual(await passiveParadigm(db, root, resolved.id), {}, `${root} ${choice}`);
        await db.tx(async (tx) => {
          const entryId = await insertEntry(tx, { text: `${root} ${choice}`, root, morphPatternId: resolved.id });
          assert.deepEqual(await storedPassive(tx, entryId), {}, `${root} ${choice}`);
        });
      }
    }
    assert.equal(reached, shape.roots.length * shape.choices.length, `${shape.shape}: patterns reached`);
  });
}

test("a hamza radical gives the same passive paradigm whichever letter carries it when the root is typed", async () => {
  const hamzated = SWEEP_SHAPES.filter((shape) =>
    [shape.classification.radical1, shape.classification.radical2, shape.classification.radical3].includes("hamza"),
  );
  assert.ok(hamzated.length > 0);
  let compared = 0;
  for (const shape of hamzated) {
    for (const root of shape.roots) {
      for (const spelling of HAMZA_SPELLINGS) {
        const respelt = root.replaceAll(HAMZA_ON_ALEF, spelling);
        for (const choice of shape.choices) {
          const onAlef = await resolve(db, root, choice);
          const other = await resolve(db, respelt, choice);
          assert.ok(onAlef && other, `${root} / ${respelt} ${choice}`);
          if (!onAlef.has_passive) {
            continue;
          }
          const left = await passiveParadigm(db, root, onAlef.id);
          const right = await passiveParadigm(db, respelt, other.id);
          for (const mood of PASSIVE_MOODS) {
            assertParadigmEqual(right[mood] ?? {}, left[mood] ?? {}, `${respelt} vs ${root} ${choice} ${mood}`);
          }
          compared += 1;
        }
      }
    }
  }
  assert.ok(compared > 0);
});
