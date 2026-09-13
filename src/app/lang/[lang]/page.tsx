import { notFound } from "next/navigation";
import EntryTable from "~/components/entry/EntryTable";
import Pagination from "~/components/Pagination";
import { formatLanguageName } from "~/lib/formatting";
import { getLexicalEntriesByLanguage } from "~/server/db/repository/lexical-entry";
import { isLanguageType, languageOptions } from "~/server/db/schema";

const PAGE_SIZE = 10;

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

  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total } = await getLexicalEntriesByLanguage({ language: lang, page, limit: PAGE_SIZE });

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Recent {formatLanguageName(lang)} Entries</h1>

      {items.length === 0 ? (
        <p className="text-gray-500">No entries found for this language.</p>
      ) : (
        <>
          <EntryTable entries={items} showRoot={lang === "ar"} />
          <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath={`/lang/${lang}`} />
        </>
      )}
    </div>
  );
}
