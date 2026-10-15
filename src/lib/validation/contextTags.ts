import { z } from "zod";

export const MAX_CONTEXT_TAGS = 10;
export const MAX_CONTEXT_TAG_LENGTH = 40;

const TAG_SEPARATORS = /[,،\n]/;

export const normalizeContextTag = (value: string): string => value.normalize("NFC").trim().replace(/\s+/g, " ");

export const dedupeContextTags = (tags: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tag);
    }
  }
  return unique;
};

export const contextTagsSchema = z
  .array(z.string())
  .transform((tags) => dedupeContextTags(tags.map(normalizeContextTag)))
  .pipe(
    z
      .array(
        z
          .string()
          .min(1, "A tag cannot be empty")
          .max(MAX_CONTEXT_TAG_LENGTH, `A tag can have at most ${MAX_CONTEXT_TAG_LENGTH} characters`),
      )
      .max(MAX_CONTEXT_TAGS, `A sense can have at most ${MAX_CONTEXT_TAGS} tags`),
  );

export type ContextTagsResult = { tags: string[]; error: null } | { tags: string[]; error: string };

export const addContextTags = (current: readonly string[], rawInput: string): ContextTagsResult => {
  const candidates = rawInput
    .split(TAG_SEPARATORS)
    .map(normalizeContextTag)
    .filter((tag) => tag !== "");
  const tooLong = candidates.find((tag) => tag.length > MAX_CONTEXT_TAG_LENGTH);
  if (tooLong !== undefined) {
    return { tags: [...current], error: `A tag can have at most ${MAX_CONTEXT_TAG_LENGTH} characters` };
  }
  const merged = dedupeContextTags([...current, ...candidates]);
  if (merged.length > MAX_CONTEXT_TAGS) {
    return { tags: [...current], error: `A sense can have at most ${MAX_CONTEXT_TAGS} tags` };
  }
  return { tags: merged, error: null };
};

export const hasTagSeparator = (value: string): boolean => TAG_SEPARATORS.test(value);
