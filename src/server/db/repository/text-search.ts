import { sql } from "drizzle-orm";
import type { LanguageType } from "~/server/db/schema";

export type TextSearchConfig = "arabic" | "english";

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export const textSearchConfigFor = (query: string, language?: LanguageType): TextSearchConfig => {
  if (language) {
    return language === "ar" ? "arabic" : "english";
  }
  return ARABIC_SCRIPT.test(query) ? "arabic" : "english";
};

export const plainTsQuery = (config: TextSearchConfig, query: string) =>
  sql`plainto_tsquery(${config}::regconfig, ${query})`;
