import type { SenseParseOutputType } from "~/components/admin/entry-edit-form/schema";
import type { SenseRelationType } from "~/server/db/schema";

export const DEFAULT_RELATION_STRENGTH = 5;

const INVERSE_RELATION_TYPES: Record<SenseRelationType, SenseRelationType> = {
  synonym: "synonym",
  antonym: "antonym",
  hyponym: "hypernym",
  hypernym: "hyponym",
  near_synonym: "near_synonym",
};

export const invertRelationType = (type: SenseRelationType): SenseRelationType => INVERSE_RELATION_TYPES[type];

export const blankToNull = (value: string | null): string | null => value || null;

export interface SavedSense {
  id: number;
  input: SenseParseOutputType;
}

export const dedupeBy = <T>(items: readonly T[], keyOf: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
