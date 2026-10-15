import { ASSIMILATION_FIXTURES } from "../../tests/fixtures/assimilation.ts";

const FATHA = String.fromCodePoint(0x064e);
const SHADDA = String.fromCodePoint(0x0651);

const geminate = (letter: string, vowel: string): string => `${letter}${vowel}${SHADDA}`;

export interface FormEightCase {
  root: string;
  text: string;
  perfect: string;
  masdar?: string;
  activeParticiple?: string;
  gloss: string;
}

const fromFixture = (id: string): FormEightCase => {
  const fixture = ASSIMILATION_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`Unknown assimilation fixture ${id}`);
  }
  return {
    root: fixture.root,
    text: fixture.citationForm,
    perfect: fixture.perfectThirdMasculineSingular,
    masdar: fixture.masdar,
    activeParticiple: fixture.activeParticiple,
    gloss: fixture.gloss,
  };
};

const IZDAHARA = `اِزْدَهَرَ`;
const IDDARASA = `اِ${geminate("د", FATHA)}رَسَ`;

export const FORM_VIII_CASES: readonly FormEightCase[] = [
  fromFixture("form-8-sad"),
  fromFixture("form-8-dad"),
  { root: "زهر", text: IZDAHARA, perfect: IZDAHARA, gloss: "to flourish, to thrive" },
  fromFixture("form-8-zah"),
  fromFixture("form-8-thal"),
  { root: "درس", text: IDDARASA, perfect: IDDARASA, gloss: "to be effaced, to wear out" },
];

export const FORM_I_PARTICIPLE_CASE = {
  root: "حسب",
  text: `حَسِبَ`,
  activeParticiple: `حَاسِب`,
  gloss: "to reckon, to suppose",
};

export interface ArabicWord {
  text: string;
  root: string;
}

export const WORDS = {
  kataba: { text: "كَتَبَ", root: "كتب" },
  kitab: { text: "كِتَاب", root: "كتب" },
  kuttab: { text: "كُتَّاب", root: "كتب" },
  qala: { text: "قَالَ", root: "قول" },
  draft: { text: "مسودة", root: "سود" },
  broken: { text: "ترجم", root: "ترجم" },
} as const satisfies Record<string, ArabicWord>;

export const ENGLISH = {
  book: "book",
  toWrite: "to write",
} as const;
