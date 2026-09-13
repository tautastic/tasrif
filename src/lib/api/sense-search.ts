import type { LanguageType, PartOfSpeechType } from "~/server/db/schema";

export const SENSE_SEARCH_MIN_QUERY_LENGTH = 2;
export const SENSE_SEARCH_DEFAULT_LIMIT = 20;
export const SENSE_SEARCH_MAX_LIMIT = 50;

export interface SenseSearchOption {
  id: number;
  text: string;
  pos: PartOfSpeechType;
  language: LanguageType;
}

export interface SenseSearchResponse {
  items: SenseSearchOption[];
  hasMore: boolean;
}
