import { z } from "zod";
import { morphologyOverridesSchema } from "~/lib/validation/morphology";
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
  text: z.string().trim().min(1, "Text is required"),
  root: z.string().nullable(),
  morphPatternId: z.number().nullable(),
  senses: z.array(senseSchema),
  morphologyOverrides: morphologyOverridesSchema.nullish(),
});

type EntryBase = z.infer<typeof entryBaseSchema>;

const hasVerbSense = (data: EntryBase) => data.senses.some((s) => s.pos === "verb");

const normalizeEntryData = <T extends EntryBase>(data: T) => {
  const base = {
    ...data,
    morphologyOverrides: data.morphologyOverrides ?? { no_passive: false },
  };

  if (base.language === "en") {
    return { ...base, root: null, morphPatternId: null };
  }
  if (!hasVerbSense(base)) {
    return { ...base, morphPatternId: null };
  }
  return base;
};

const validateEntryData = (data: EntryBase, ctx: z.RefinementCtx) => {
  if (data.language !== "ar") {
    return;
  }

  if (!data.root?.trim()) {
    ctx.addIssue({ code: "custom", message: "Root is required for Arabic entries", path: ["root"] });
  }

  if (hasVerbSense(data)) {
    if (!data.morphPatternId) {
      ctx.addIssue({
        code: "custom",
        message: "Morphological pattern is required for Arabic entries with verb senses",
        path: ["morphPatternId"],
      });
    }
  } else if (data.morphPatternId) {
    ctx.addIssue({
      code: "custom",
      message: "Morphological pattern is only allowed for entries with verb senses",
      path: ["morphPatternId"],
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

export const entryCreateSchema = entryBaseSchema.transform(normalizeEntryData).superRefine(validateEntryData);
export const entryEditSchema = entryBaseSchema
  .extend({ id: entryIdSchema })
  .transform(normalizeEntryData)
  .superRefine(validateEntryData);

export const entryFormSchema = entryBaseSchema
  .extend({ id: entryIdSchema.optional() })
  .transform(normalizeEntryData)
  .superRefine(validateEntryData);

export type SenseParseInputType = z.input<typeof senseSchema>;
export type SenseParseOutputType = z.output<typeof senseSchema>;

export type EntryCreateType = z.output<typeof entryCreateSchema>;
export type EntryEditType = z.output<typeof entryEditSchema>;

export type EntryFormInput = z.input<typeof entryFormSchema>;
export type EntryFormValues = z.output<typeof entryFormSchema>;
