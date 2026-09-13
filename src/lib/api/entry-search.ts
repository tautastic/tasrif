import type { LanguageType } from "~/server/db/schema";

export const ENTRY_SEARCH_DEFAULT_LIMIT = 10;
export const ENTRY_SEARCH_MAX_LIMIT = 20;

export interface EntrySearchResult {
  id: number;
  text: string;
  normalizedText: string;
  language: LanguageType;
  root: string | null;
}

export interface EntrySearchResponse {
  items: EntrySearchResult[];
}
