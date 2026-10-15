import { z } from "zod";
import { contextTagsSchema } from "~/lib/validation/contextTags";
import { isArabicScriptText, morphologyOverridesSchema, OVERRIDE_TEXT_KEYS } from "~/lib/validation/morphology";
import {
  BARE_ALEF_ROOT_MESSAGE,
  countRadicals,
  hasBareAlef,
  MAX_ROOT_LENGTH,
  normalizeRoot,
  QUADRILITERAL_ROOT_RADICALS,
  VERB_ROOT_RADICALS,
} from "~/lib/validation/root";
import { verbFormChoiceRadicalCount, verbFormChoiceSchema } from "~/lib/validation/verbFormChoice";
import { languageOptions, type PartOfSpeechType, posTypeEnum, senseRelationTypeEnum } from "~/server/db/schema";

const senseSchema = z.object({
  id: z.number().optional(),
  pos: z
    .enum(posTypeEnum.enumValues, {
      error: "Part of speech is required",
    })
    .nullable()
    .refine((value): value is PartOfSpeechType => !!value, {
      error: "Part of speech is required",
    }),
  senseNumber: z
    .int({
      error: "Sense number is required",
    })
    .positive({
      error: "Sense number has to be positive",
    }),
  definitions: z.array(z.string().trim()).transform((s) => s.filter((e) => e.trim() !== "")),
  contextTags: contextTagsSchema.optional(),
  examples: z.array(z.string().trim()).transform((s) => s.filter((e) => e.trim() !== "")),
  translations: z.array(
    z.object({
      targetSenseId: z.int().positive(),
      domain: z.string().max(50).nullable(),
      note: z.string().nullable(),
    }),
  ),
  relatedSenses: z.array(
    z.object({
      targetSenseId: z.int().positive(),
      relationType: z.enum(senseRelationTypeEnum.enumValues),
      contextNote: z.string().nullable(),
      strength: z.int().min(1).max(10).nullable(),
    }),
  ),
});

const entryBaseSchema = z.object({
  language: z.enum(languageOptions, {
    error: "Language must be 'en' or 'ar'",
  }),
  text: z.string().normalize("NFC").trim().min(1, "Text is required").max(255, "Text can have at most 255 characters"),
  root: z
    .string()
    .nullable()
    .transform((value) => (value === null ? null : normalizeRoot(value))),
  verbFormChoice: verbFormChoiceSchema.nullable(),
  chosenMorphPatternId: z.int({ error: "Pattern id must be an integer" }).positive().nullish(),
  senses: z.array(senseSchema),
  morphologyOverrides: morphologyOverridesSchema.nullish(),
  isVerified: z.boolean().default(false),
});

type EntryBase = z.infer<typeof entryBaseSchema>;

const hasVerbSense = (data: EntryBase) => data.senses.some((s) => s.pos === "verb");

const normalizeEntryData = <T extends EntryBase>(data: T) => {
  const base = {
    ...data,
    morphologyOverrides: data.morphologyOverrides ?? { no_passive: false },
  };

  if (base.language === "en") {
    return { ...base, root: null, verbFormChoice: null };
  }
  if (!hasVerbSense(base)) {
    return { ...base, verbFormChoice: null };
  }
  return base;
};

const verbRootLengths = (choice: EntryBase["verbFormChoice"]): number[] =>
  choice === null ? [VERB_ROOT_RADICALS, QUADRILITERAL_ROOT_RADICALS] : [verbFormChoiceRadicalCount(choice)];

const verbRootLengthMessage = (choice: EntryBase["verbFormChoice"]): string =>
  choice === null
    ? `A verb root must have ${VERB_ROOT_RADICALS} or ${QUADRILITERAL_ROOT_RADICALS} letters`
    : `A ${verbFormChoiceRadicalCount(choice) === QUADRILITERAL_ROOT_RADICALS ? "quadriliteral " : ""}verb root must have exactly ${verbFormChoiceRadicalCount(choice)} letters`;

const validateEntryData = (data: EntryBase, ctx: z.RefinementCtx) => {
  if (data.language !== "ar") {
    return;
  }

  if (!data.root) {
    ctx.addIssue({ code: "custom", message: "Root is required for Arabic entries", path: ["root"] });
  } else if (countRadicals(data.root) > MAX_ROOT_LENGTH) {
    ctx.addIssue({
      code: "custom",
      message: `Root can have at most ${MAX_ROOT_LENGTH} letters`,
      path: ["root"],
    });
  } else if (
    (hasVerbSense(data) || data.verbFormChoice) &&
    !verbRootLengths(data.verbFormChoice).includes(countRadicals(data.root))
  ) {
    ctx.addIssue({
      code: "custom",
      message: verbRootLengthMessage(data.verbFormChoice),
      path: ["root"],
    });
  } else if ((hasVerbSense(data) || data.verbFormChoice) && hasBareAlef(data.root)) {
    ctx.addIssue({ code: "custom", message: BARE_ALEF_ROOT_MESSAGE, path: ["root"] });
  }

  for (const key of OVERRIDE_TEXT_KEYS) {
    const value = data.morphologyOverrides?.[key];
    if (value !== undefined && !isArabicScriptText(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Write this form in Arabic script",
        path: ["morphologyOverrides", key],
      });
    }
  }

  if (hasVerbSense(data)) {
    if (!data.verbFormChoice) {
      ctx.addIssue({
        code: "custom",
        message: "Verb form is required for Arabic entries with verb senses",
        path: ["verbFormChoice"],
      });
    }
  } else if (data.verbFormChoice) {
    ctx.addIssue({
      code: "custom",
      message: "Verb form is only allowed for entries with verb senses",
      path: ["verbFormChoice"],
    });
  }
};

const entryIdSchema = z
  .int({
    error: "ID must be provided",
  })
  .positive({
    error: "ID must be positive",
  });

export const entryCreateSchema = entryBaseSchema.superRefine(validateEntryData).transform(normalizeEntryData);
export const entryEditSchema = entryBaseSchema
  .extend({ id: entryIdSchema })
  .superRefine(validateEntryData)
  .transform(normalizeEntryData);

export const entryFormSchema = entryBaseSchema
  .extend({ id: entryIdSchema.optional() })
  .superRefine(validateEntryData)
  .transform(normalizeEntryData);

export type SenseParseOutputType = z.output<typeof senseSchema>;

export type EntryCreateType = z.output<typeof entryCreateSchema>;
export type EntryEditType = z.output<typeof entryEditSchema>;

export type EntryFormInput = z.input<typeof entryFormSchema>;
export type EntryFormValues = z.output<typeof entryFormSchema>;
