import type { AffixMoodType, AlternativeNounKind, PersonType } from "~/server/db/schema";

export type AlternativeFormsByCell = Partial<Record<AffixMoodType, Partial<Record<PersonType, readonly string[]>>>>;

export type AlternativeNounsByKind = Partial<Record<AlternativeNounKind, readonly string[]>>;

const NO_FORMS: readonly string[] = [];

export const alternativeFormsFor = (
  alternatives: AlternativeFormsByCell | undefined,
  mood: AffixMoodType,
  person: PersonType | undefined,
): readonly string[] => (person ? (alternatives?.[mood]?.[person] ?? NO_FORMS) : NO_FORMS);

export const alternativeNounsFor = (
  nouns: AlternativeNounsByKind | undefined,
  kind: AlternativeNounKind,
): readonly string[] => nouns?.[kind] ?? NO_FORMS;
