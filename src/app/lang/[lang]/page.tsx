import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "~/app/site";
import PaginatedEntryList from "~/components/entry/PaginatedEntryList";
import { formatCount, formatLanguageName } from "~/lib/formatting";
import {
  ENTRY_LIST_PAGE_SIZE,
  notFoundIfOutOfRange,
  parsePageParam,
  withPageParam,
  withPageTitle,
} from "~/lib/pagination";
import { getCachedLanguagePage, getCachedLanguageTotal } from "~/server/cache/public-queries";
import { isLanguageType } from "~/server/db/schema";

type LangPageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string }>;
};

export const generateMetadata = async ({ params, searchParams }: LangPageProps): Promise<Metadata> => {
  const [{ lang }, { page: pageParam }] = await Promise.all([params, searchParams]);
  if (!isLanguageType(lang)) {
    return {};
  }

  const page = parsePageParam(pageParam);
  const language = formatLanguageName(lang);
  return buildPageMetadata({
    title: withPageTitle(`${language} Entries`, page),
    description: `Browse the ${language} entries of the Tasrif dictionary.`,
    path: withPageParam(`/lang/${lang}`, page),
  });
};

export default async function LangPage({ params, searchParams }: LangPageProps) {
  const [{ lang }, { page: pageParam }] = await Promise.all([params, searchParams]);

  if (!isLanguageType(lang)) {
    notFound();
  }

  const page = parsePageParam(pageParam);
  notFoundIfOutOfRange({ page, total: await getCachedLanguageTotal(lang), pageSize: ENTRY_LIST_PAGE_SIZE });
  const { items, total } = await getCachedLanguagePage(lang, page, ENTRY_LIST_PAGE_SIZE);

  return (
    <PaginatedEntryList
      heading={`${formatLanguageName(lang)} Entries`}
      description={`The following ${formatCount(items.length, "entry", "entries")} ${items.length === 1 ? "is" : "are"} in this language, out of ${total} total:`}
      entries={items}
      language={lang}
      page={page}
      total={total}
      pageSize={ENTRY_LIST_PAGE_SIZE}
      basePath={`/lang/${lang}`}
    />
  );
}
