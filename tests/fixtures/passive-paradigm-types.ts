import { PERSONS, type Person } from "../harness/morphology.ts";

export type FormIVowel = "a" | "i" | "u";

export type FullPersonCells = Record<Person, string>;

export interface PassiveParadigmFixture {
  id: string;
  shape: string;
  formNumber: number;
  radicalCount?: 3 | 4;
  perfectVowel: FormIVowel | null;
  imperfectVowel: FormIVowel | null;
  root: string;
  patternCode: string;
  lexical: boolean;
  citationForm: string;
  gloss: string;
  source: string;
  notes?: string[];
  perfect: FullPersonCells;
  imperfectIndicative: FullPersonCells;
  imperfectSubjunctive: FullPersonCells;
  imperfectJussive: FullPersonCells;
}

export const cells = (text: string): FullPersonCells => {
  const words = text.split(" ");
  if (words.length !== PERSONS.length) {
    throw new Error(`Expected ${PERSONS.length} cells, found ${words.length}: ${text}`);
  }
  const result = {} as FullPersonCells;
  PERSONS.forEach((person, index) => {
    result[person] = words[index] ?? "";
  });
  return result;
};
