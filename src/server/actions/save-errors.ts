import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { type ActionResult, fail } from "~/server/actions/result";
import {
  getPgErrorWithCode,
  INVALID_ROOT_SQLSTATE,
  isForeignKeyViolation,
  isUniqueViolation,
} from "~/server/db/pg-error";

export const UNIQUE_ENTRY_CONSTRAINT = "unique_language_text";
export const UNIQUE_SENSE_NUMBER_CONSTRAINT = "unique_sense_number";
export const UNIQUE_PATTERN_CONSTRAINT = "unique_form_number_description";
export const UNIQUE_PATTERN_RESOLUTION_CONSTRAINT = "unique_morph_pattern_resolution_key";
export const UNIQUE_OVERRIDE_CONSTRAINT = "unique_lexical_pattern_override_key";

export const invalidRootMessage = (root: string, radicalCount = 3) =>
  `Root '${root}' is not a valid ${radicalCount === 4 ? "quadriliteral" : "triliteral"} root`;

export const mapEntrySaveError = (error: unknown, root: string | null, radicalCount = 3): ActionResult<never> => {
  if (isUniqueViolation(error, UNIQUE_ENTRY_CONSTRAINT)) {
    return fail("An entry with this language and text already exists");
  }
  if (isUniqueViolation(error, UNIQUE_SENSE_NUMBER_CONSTRAINT)) {
    return fail("Sense numbers must be unique within an entry");
  }
  if (root && getPgErrorWithCode(error, INVALID_ROOT_SQLSTATE)) {
    return fail(invalidRootMessage(root, radicalCount));
  }
  throw error;
};

export const mapPatternSaveError = (
  error: unknown,
  pattern: { formNumber: number; radicalCount?: number; description: string },
): ActionResult<never> => {
  if (isUniqueViolation(error, UNIQUE_PATTERN_CONSTRAINT)) {
    return fail(
      `A form ${formatMorphPatternFormNumber(pattern.formNumber, pattern.radicalCount)} pattern with description "${pattern.description}" already exists`,
    );
  }
  if (isUniqueViolation(error, UNIQUE_PATTERN_RESOLUTION_CONSTRAINT)) {
    return fail(
      "Another pattern already handles this combination of root shape, form and vowels. Edit that pattern, or change the root shape or vowels of this one",
    );
  }
  throw error;
};

export const mapOverrideSaveError = (error: unknown): ActionResult<never> => {
  if (isUniqueViolation(error, UNIQUE_OVERRIDE_CONSTRAINT)) {
    return fail("An override for this root, form number, and vowels already exists");
  }
  if (isForeignKeyViolation(error)) {
    return fail("The morphological pattern no longer exists");
  }
  throw error;
};
