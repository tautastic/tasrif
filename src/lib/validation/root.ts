import { z } from "zod";

export const VERB_ROOT_RADICALS = 3;
export const QUADRILITERAL_ROOT_RADICALS = 4;
export const MAX_ROOT_LENGTH = 10;
const MAX_RAW_ROOT_LENGTH = 100;

const ROOT_NOISE_PATTERN = /[ـً-ٰٟۖ-ۭ ‌-‏\s-]/g;

const ALEF_MAKSURA_PATTERN = /ى/g;

export const BARE_ALEF_ROOT_MESSAGE = "Write a weak radical as و or ي, not ا";

export const normalizeRoot = (value: string): string =>
  value.normalize("NFC").replace(ROOT_NOISE_PATTERN, "").replace(ALEF_MAKSURA_PATTERN, "ي");

export const hasBareAlef = (root: string): boolean => root.includes("ا");

export const countRadicals = (root: string): number => Array.from(root).length;

export const triliteralRootSchema = z
  .string()
  .max(MAX_RAW_ROOT_LENGTH, `Root can have at most ${MAX_RAW_ROOT_LENGTH} characters`)
  .transform(normalizeRoot)
  .pipe(
    z
      .string()
      .min(1, "Root is required")
      .refine((root) => countRadicals(root) === VERB_ROOT_RADICALS, {
        error: `Root must have exactly ${VERB_ROOT_RADICALS} letters`,
      })
      .refine((root) => !hasBareAlef(root), { error: BARE_ALEF_ROOT_MESSAGE }),
  );

export const rootLengthMessage = (radicals: number): string => `Root must have exactly ${radicals} letters`;

export const verbRootSchema = z
  .string()
  .max(MAX_RAW_ROOT_LENGTH, `Root can have at most ${MAX_RAW_ROOT_LENGTH} characters`)
  .transform(normalizeRoot)
  .pipe(
    z
      .string()
      .min(1, "Root is required")
      .refine((root) => !hasBareAlef(root), { error: BARE_ALEF_ROOT_MESSAGE }),
  );
