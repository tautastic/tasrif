import type { Person } from "../harness/morphology.ts";
import { FORM_I_FIXTURES } from "./weak-paradigms-form-1.ts";
import { FORMS_II_TO_V_FIXTURES } from "./weak-paradigms-forms-2-5.ts";
import { FORMS_VI_TO_X_FIXTURES } from "./weak-paradigms-forms-6-10.ts";

export type FormIVowel = "a" | "i" | "u";

export type FullPersonCells = Record<Person, string>;

export type ImperativePerson =
  | "second_person_masculine_singular"
  | "second_person_feminine_singular"
  | "second_person_dual"
  | "second_person_masculine_plural"
  | "second_person_feminine_plural";

export type ImperativeCells = Record<ImperativePerson, string>;

export interface WeakParadigmFixture {
  id: string;
  shape: string;
  formNumber: number;
  perfectVowel: FormIVowel | null;
  imperfectVowel: FormIVowel | null;
  root: string;
  patternCode: string | null;
  lexical: boolean;
  citationForm: string;
  gloss: string;
  source: string;
  notes?: string[];
  pending?: string;
  engineDeviations?: Partial<Record<"masdar" | "activeParticiple" | "passiveParticiple", string | null>>;
  perfect: FullPersonCells;
  imperfectIndicative: FullPersonCells;
  imperfectSubjunctive: FullPersonCells;
  imperfectJussive: FullPersonCells;
  imperative: ImperativeCells;
  masdar: string | null;
  activeParticiple: string | null;
  passiveParticiple: string | null;
}

export const WEAK_PARADIGM_FIXTURES: WeakParadigmFixture[] = [
  ...FORM_I_FIXTURES,
  ...FORMS_II_TO_V_FIXTURES,
  ...FORMS_VI_TO_X_FIXTURES,
];
