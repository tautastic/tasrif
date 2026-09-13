import { notFound } from "next/navigation";
import PaginatedEntryList from "~/components/entry/PaginatedEntryList";
import { formatLanguageName } from "~/lib/formatting";
import { ENTRY_LIST_PAGE_SIZE, notFoundIfEmpty, parsePageParam } from "~/lib/pagination";
import { getLexicalEntriesByLanguage } from "~/server/db/repository/lexical-entry";
import { isLanguageType, languageOptions } from "~/server/db/schema";

export const revalidate = 3600;

export function generateStaticParams() {
  return languageOptions.map((lang) => ({ lang }));
}

export default async function LangPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ lang }, { page: pageParam }] = await Promise.all([params, searchParams]);

  if (!isLanguageType(lang)) {
    notFound();
  }

  const page = parsePageParam(pageParam);
  const { items, total } = await getLexicalEntriesByLanguage({ language: lang, page, limit: ENTRY_LIST_PAGE_SIZE });
  notFoundIfEmpty(total);

  return (
    <PaginatedEntryList
      heading={`${formatLanguageName(lang)} Entries`}
      description={`The following ${items.length} entries are in this language, out of ${total} total:`}
      entries={items}
      language={lang}
      page={page}
      total={total}
      pageSize={ENTRY_LIST_PAGE_SIZE}
      basePath={`/lang/${lang}`}
    />
  );
}
