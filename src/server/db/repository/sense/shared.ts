import type { SenseParseOutputType } from "~/components/admin/entry-edit-form/schema";

export const DEFAULT_RELATION_STRENGTH = 5;

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
