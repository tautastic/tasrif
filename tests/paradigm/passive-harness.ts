import type { Db, Mood, Paradigm, Person, SqlParam } from "../harness";

export const passiveParadigm = async (
  db: Db,
  root: string,
  patternId: number,
  overrides: Record<string, SqlParam> = {},
): Promise<Paradigm> => {
  const rows = await db.rows<{ mood: Mood; person: Person; form: string }>(
    `SELECT pr.mood::text AS mood, kv.key AS person, kv.value AS form
     FROM morph_pattern mp,
          LATERAL generate_passive_rows($1, mp.rules, mp.form_number, $3::jsonb, mp.no_affix) pr,
          LATERAL jsonb_each_text(pr.person_forms) kv
     WHERE mp.id = $2`,
    [root, patternId, JSON.stringify(overrides)],
  );
  const paradigm: Paradigm = {};
  for (const row of rows) {
    const cells = paradigm[row.mood] ?? {};
    cells[row.person] = row.form;
    paradigm[row.mood] = cells;
  }
  return paradigm;
};

const LETTER = /[ء-غف-ي]/u;
const MARK = /[ً-ْ]/u;
const ALEF = "ا";
const ALEF_MADDA = "آ";
const ALEF_MAKSURA = "ى";
const WAW = "و";
const YEH = "ي";
const DAMMA = "ُ";
const KASRA = "ِ";
const SHADDA = "ّ";
const SUKUN = "ْ";

const unvocalisedLetters = (form: string): string[] => {
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
    problems.push(`${char} at ${index}`);
  });
  return problems;
};

export const passiveAnomalies = (form: string): string[] => {
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
  if (form.includes(DAMMA + YEH + SUKUN)) {
    found.push("a vowelless ya after damma");
  }
  const letters = [...form].filter((char) => LETTER.test(char)).length;
  if (letters < 1 || letters > 12) {
    found.push(`letter count ${letters} outside 1..12`);
  }
  for (const problem of unvocalisedLetters(form)) {
    found.push(`unvocalised letter ${problem}`);
  }
  return found;
};
