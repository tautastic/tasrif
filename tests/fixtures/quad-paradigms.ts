import type { QuadriliteralVerbFormChoice } from "~/lib/validation/verbFormChoice";
import type { Person } from "../harness/morphology.ts";
import { FORM_3Q_FINAL_WEAK_FIXTURES } from "./quad-paradigms-final-weak.ts";
import { FORM_1Q_FIXTURES } from "./quad-paradigms-form-1q.ts";
import { FORMS_2Q_TO_4Q_FIXTURES } from "./quad-paradigms-forms-2q-4q.ts";

export type FullPersonCells = Record<Person, string>;

export type ImperativePerson =
  | "second_person_masculine_singular"
  | "second_person_feminine_singular"
  | "second_person_dual"
  | "second_person_masculine_plural"
  | "second_person_feminine_plural";

export type ImperativeCells = Record<ImperativePerson, string>;

export interface QuadParadigmFixture {
  id: string;
  shape: string;
  choice: QuadriliteralVerbFormChoice;
  root: string;
  patternCode: string;
  citationForm: string;
  gloss: string;
  source: string;
  notes?: string[];
  perfect: FullPersonCells;
  imperfectIndicative: FullPersonCells;
  imperfectSubjunctive: FullPersonCells;
  imperfectJussive: FullPersonCells;
  imperative: ImperativeCells;
  masdar: string;
  activeParticiple: string;
  passiveParticiple: string | null;
}

export const QUAD_PARADIGM_FIXTURES: QuadParadigmFixture[] = [
  ...FORM_1Q_FIXTURES,
  ...FORMS_2Q_TO_4Q_FIXTURES,
  ...FORM_3Q_FINAL_WEAK_FIXTURES,
];
