import { unstable_cache } from "next/cache";
import { PUBLIC_DATA_TAG } from "~/server/cache/tags";
import {
  getLexicalEntriesByFormNumber,
  getLexicalEntriesByLanguage,
  getRandomLexicalEntries,
  getRecentLexicalEntries,
} from "~/server/db/repository/lexical-entry";
import { countSitemapEntrySlugs, getSitemapEntrySlugs } from "~/server/db/repository/lexical-entry/sitemap";
import { getVerbFormsWithCounts } from "~/server/db/repository/morph-pattern";
import type { LanguageType } from "~/server/db/schema";

export interface EntrySummary {
  id: number;
  text: string;
  slug: string;
  language: LanguageType;
}

export interface EntryListPage {
  items: EntrySummary[];
  total: number;
}

export interface VerbFormCount {
  formNumber: number;
  radicalCount?: 4;
  total: number;
}

const LISTING_REVALIDATE_SECONDS = 3600;
const RANDOM_REVALIDATE_SECONDS = 60;
const LISTING_OPTIONS = { tags: [PUBLIC_DATA_TAG], revalidate: LISTING_REVALIDATE_SECONDS };
const RANDOM_OPTIONS = { tags: [PUBLIC_DATA_TAG], revalidate: RANDOM_REVALIDATE_SECONDS };

const toSummary = ({ id, text, slug, language }: EntrySummary): EntrySummary => ({
  id,
  text,
  slug,
  language,
});

const toListPage = ({ items, total }: { items: EntrySummary[]; total: number }): EntryListPage => ({
  items: items.map(toSummary),
  total,
});

export const getCachedRecentEntries = unstable_cache(
  async (): Promise<EntrySummary[]> => (await getRecentLexicalEntries()).map(toSummary),
  ["public", "recent-entries"],
  LISTING_OPTIONS,
);

export const getCachedRandomEntries = unstable_cache(
  async (): Promise<EntrySummary[]> => (await getRandomLexicalEntries()).map(toSummary),
  ["public", "random-entries"],
  RANDOM_OPTIONS,
);

export const getCachedLanguageTotal = unstable_cache(
  async (language: LanguageType): Promise<number> =>
    (await getLexicalEntriesByLanguage({ language, page: 1, limit: 1 })).total,
  ["public", "language-total"],
  LISTING_OPTIONS,
);

export const getCachedLanguagePage = unstable_cache(
  async (language: LanguageType, page: number, limit: number): Promise<EntryListPage> =>
    toListPage(await getLexicalEntriesByLanguage({ language, page, limit })),
  ["public", "language-page"],
  LISTING_OPTIONS,
);

export const getCachedVerbForms = unstable_cache(
  async (): Promise<VerbFormCount[]> => getVerbFormsWithCounts(),
  ["public", "verb-forms"],
  LISTING_OPTIONS,
);

export const getCachedFormPage = unstable_cache(
  async (formNumber: number, page: number, limit: number, radicalCount = 3): Promise<EntryListPage> =>
    toListPage(await getLexicalEntriesByFormNumber({ formNumber, radicalCount, page, limit })),
  ["public", "form-page"],
  LISTING_OPTIONS,
);

export const getCachedSitemapSlugCount = unstable_cache(
  async (): Promise<number> => countSitemapEntrySlugs(),
  ["public", "sitemap-count"],
  LISTING_OPTIONS,
);

export const getCachedSitemapSlugs = unstable_cache(
  async (offset: number, limit: number): Promise<string[]> => getSitemapEntrySlugs({ offset, limit }),
  ["public", "sitemap-slugs"],
  LISTING_OPTIONS,
);
