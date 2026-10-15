import type { EntryPageEntry, EntryPageSense } from "~/server/db/repository/lexical-entry";
import type { ConjugationSelect, PersonType } from "~/server/db/schema";

export const makeSense = (overrides: Partial<EntryPageSense> & Pick<EntryPageSense, "id">): EntryPageSense => ({
  lexicalEntryId: 1,
  pos: "noun",
  senseNumber: 1,
  definitions: [],
  contextTags: [],
  examples: [],
  translations: [],
  relatedSenses: [],
  ...overrides,
});

export const makeEntry = (
  overrides: Partial<EntryPageEntry> & Pick<EntryPageEntry, "id" | "text">,
): EntryPageEntry => ({
  language: "ar",
  normalizedText: overrides.text,
  slug: overrides.text,
  root: null,
  latinRoot: null,
  morphPatternId: null,
  morphologyOverrides: null,
  masdar: null,
  activeParticiple: null,
  passiveParticiple: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  isVerified: true,
  morphPattern: null,
  senses: [],
  conjugations: [],
  ...overrides,
});

export const makeConjugation = (
  entryId: number,
  id: number,
  mood: ConjugationSelect["mood"],
  person: PersonType,
  form: string,
): ConjugationSelect => ({ id, lexicalEntryId: entryId, voice: "active", mood, person, form });
