import type { z } from "zod";
import type { ShortVowel } from "~/server/db/schema";

interface FormOneVowelFields {
  formNumber: number;
  perfectVowel: ShortVowel | null;
  imperfectVowel: ShortVowel | null;
}

export const validateFormOneVowels = (data: FormOneVowelFields, ctx: z.RefinementCtx) => {
  const hasBothVowels = data.perfectVowel !== null && data.imperfectVowel !== null;
  const hasEitherVowel = data.perfectVowel !== null || data.imperfectVowel !== null;
  if (data.formNumber === 1 && !hasBothVowels) {
    ctx.addIssue({
      code: "custom",
      message: "Form I needs both a perfect and an imperfect vowel",
      path: ["perfectVowel"],
    });
  }
  if (data.formNumber !== 1 && hasEitherVowel) {
    ctx.addIssue({ code: "custom", message: "Perfect/imperfect vowels only apply to form I", path: ["perfectVowel"] });
  }
};
