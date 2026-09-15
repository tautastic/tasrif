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
export type VerbFormChoice = (typeof verbFormChoices)[number];

export const verbFormChoiceSchema = z.enum(verbFormChoices);

export interface ResolvedVerbForm {
  formNumber: number;
  perfectVowel: ShortVowel | null;
  imperfectVowel: ShortVowel | null;
}

const VERB_FORM_CHOICE_DETAILS: Record<VerbFormChoice, ResolvedVerbForm> = {
  "form-1-a-u": { formNumber: 1, perfectVowel: "a", imperfectVowel: "u" },
  "form-1-a-a": { formNumber: 1, perfectVowel: "a", imperfectVowel: "a" },
  "form-1-a-i": { formNumber: 1, perfectVowel: "a", imperfectVowel: "i" },
  "form-1-i-a": { formNumber: 1, perfectVowel: "i", imperfectVowel: "a" },
  "form-1-i-i": { formNumber: 1, perfectVowel: "i", imperfectVowel: "i" },
  "form-1-u-u": { formNumber: 1, perfectVowel: "u", imperfectVowel: "u" },
  "form-2": { formNumber: 2, perfectVowel: null, imperfectVowel: null },
  "form-3": { formNumber: 3, perfectVowel: null, imperfectVowel: null },
  "form-4": { formNumber: 4, perfectVowel: null, imperfectVowel: null },
  "form-5": { formNumber: 5, perfectVowel: null, imperfectVowel: null },
  "form-6": { formNumber: 6, perfectVowel: null, imperfectVowel: null },
  "form-7": { formNumber: 7, perfectVowel: null, imperfectVowel: null },
  "form-8": { formNumber: 8, perfectVowel: null, imperfectVowel: null },
  "form-9": { formNumber: 9, perfectVowel: null, imperfectVowel: null },
  "form-10": { formNumber: 10, perfectVowel: null, imperfectVowel: null },
};

export const resolveVerbFormChoice = (choice: VerbFormChoice): ResolvedVerbForm => VERB_FORM_CHOICE_DETAILS[choice];

export const findVerbFormChoice = (pattern: ResolvedVerbForm): VerbFormChoice | undefined =>
  verbFormChoices.find((choice) => {
    const details = VERB_FORM_CHOICE_DETAILS[choice];
    return (
      details.formNumber === pattern.formNumber &&
      details.perfectVowel === pattern.perfectVowel &&
      details.imperfectVowel === pattern.imperfectVowel
    );
  });

export const formatVerbFormChoiceLabel = (choice: VerbFormChoice): string => {
  const { formNumber, perfectVowel, imperfectVowel } = VERB_FORM_CHOICE_DETAILS[choice];
  const numeral = formatMorphPatternFormNumber(formNumber);
  return perfectVowel && imperfectVowel ? `Form ${numeral} (${perfectVowel} ~ ${imperfectVowel})` : `Form ${numeral}`;
};
