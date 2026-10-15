import { z } from "zod";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import type { ShortVowel } from "~/server/db/schema";

export const formIVerbFormChoices = [
  "form-1-a-u",
  "form-1-a-a",
  "form-1-a-i",
  "form-1-i-a",
  "form-1-i-i",
  "form-1-u-u",
] as const;

export const higherVerbFormChoices = [
  "form-2",
  "form-3",
  "form-4",
  "form-5",
  "form-6",
  "form-7",
  "form-8",
  "form-9",
  "form-10",
] as const;

export const verbFormChoices = [...formIVerbFormChoices, ...higherVerbFormChoices] as const;
export type TriliteralVerbFormChoice = (typeof verbFormChoices)[number];

export const quadriliteralVerbFormChoices = ["form-1q", "form-2q", "form-3q", "form-4q"] as const;
export type QuadriliteralVerbFormChoice = (typeof quadriliteralVerbFormChoices)[number];

export const allVerbFormChoices = [...verbFormChoices, ...quadriliteralVerbFormChoices] as const;
export type VerbFormChoice = TriliteralVerbFormChoice | QuadriliteralVerbFormChoice;

export const verbFormChoiceSchema = z.enum(allVerbFormChoices);

export type RadicalCount = 3 | 4;

export interface ResolvedVerbForm {
  formNumber: number;
  radicalCount: RadicalCount;
  perfectVowel: ShortVowel | null;
  imperfectVowel: ShortVowel | null;
}

const VERB_FORM_CHOICE_DETAILS: Record<VerbFormChoice, ResolvedVerbForm> = {
  "form-1-a-u": { formNumber: 1, radicalCount: 3, perfectVowel: "a", imperfectVowel: "u" },
  "form-1-a-a": { formNumber: 1, radicalCount: 3, perfectVowel: "a", imperfectVowel: "a" },
  "form-1-a-i": { formNumber: 1, radicalCount: 3, perfectVowel: "a", imperfectVowel: "i" },
  "form-1-i-a": { formNumber: 1, radicalCount: 3, perfectVowel: "i", imperfectVowel: "a" },
  "form-1-i-i": { formNumber: 1, radicalCount: 3, perfectVowel: "i", imperfectVowel: "i" },
  "form-1-u-u": { formNumber: 1, radicalCount: 3, perfectVowel: "u", imperfectVowel: "u" },
  "form-2": { formNumber: 2, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-3": { formNumber: 3, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-4": { formNumber: 4, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-5": { formNumber: 5, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-6": { formNumber: 6, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-7": { formNumber: 7, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-8": { formNumber: 8, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-9": { formNumber: 9, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-10": { formNumber: 10, radicalCount: 3, perfectVowel: null, imperfectVowel: null },
  "form-1q": { formNumber: 1, radicalCount: 4, perfectVowel: "a", imperfectVowel: "i" },
  "form-2q": { formNumber: 2, radicalCount: 4, perfectVowel: null, imperfectVowel: null },
  "form-3q": { formNumber: 3, radicalCount: 4, perfectVowel: null, imperfectVowel: null },
  "form-4q": { formNumber: 4, radicalCount: 4, perfectVowel: null, imperfectVowel: null },
};

export const resolveVerbFormChoice = (choice: VerbFormChoice): ResolvedVerbForm => VERB_FORM_CHOICE_DETAILS[choice];

export const findVerbFormChoice = (
  pattern: Omit<ResolvedVerbForm, "radicalCount"> & { radicalCount?: number },
): VerbFormChoice | undefined =>
  allVerbFormChoices.find((choice) => {
    const details = VERB_FORM_CHOICE_DETAILS[choice];
    return (
      details.formNumber === pattern.formNumber &&
      details.radicalCount === (pattern.radicalCount ?? 3) &&
      details.perfectVowel === pattern.perfectVowel &&
      details.imperfectVowel === pattern.imperfectVowel
    );
  });

export const formatVerbFormChoiceLabel = (choice: VerbFormChoice): string => {
  const { formNumber, radicalCount, perfectVowel, imperfectVowel } = VERB_FORM_CHOICE_DETAILS[choice];
  const numeral = formatMorphPatternFormNumber(formNumber, radicalCount);
  return radicalCount === 3 && perfectVowel && imperfectVowel
    ? `Form ${numeral} (${perfectVowel} ~ ${imperfectVowel})`
    : `Form ${numeral}`;
};

export const verbFormChoiceRadicalCount = (choice: VerbFormChoice): RadicalCount =>
  VERB_FORM_CHOICE_DETAILS[choice].radicalCount;
