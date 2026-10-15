import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "~/app/site";
import Pagination from "~/components/Pagination";
import { entryPath, formatCount, formatLanguageName, formatRoot } from "~/lib/formatting";
import { parsePageParam } from "~/lib/pagination";
import { searchLexicalEntries } from "~/server/db/repository/lexical-entry";

const SEARCH_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 100;
const MAX_PAGES = 5;

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string }>;
}

const parseQuery = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim().slice(0, MAX_QUERY_LENGTH) ?? "";

export const generateMetadata = async ({ searchParams }: SearchPageProps): Promise<Metadata> => {
  const { q } = await searchParams;
  const query = parseQuery(q);
  return buildPageMetadata({
    title: query ? `Search: ${query}` : "Search",
    description: "Search the Tasrif Arabic–English dictionary.",
    path: "/search",
    noIndex: true,
  });
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page: pageParam } = await searchParams;
  const query = parseQuery(q);
  const page = parsePageParam(pageParam);
  if (page > MAX_PAGES) {
    notFound();
  }

  const fetched = query ? await searchLexicalEntries(query, SEARCH_PAGE_SIZE + 1, (page - 1) * SEARCH_PAGE_SIZE) : [];
  const items = fetched.slice(0, SEARCH_PAGE_SIZE);
  if (page > 1 && items.length === 0) {
    notFound();
  }
  const hasNextPage = fetched.length > SEARCH_PAGE_SIZE && page < MAX_PAGES;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{query ? <>Search results for “{query}”</> : "Search"}</h1>

      <search aria-label="Search results">
        <form action="/search" method="get" className="flex max-w-md gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            dir="auto"
            aria-label="Search Dictionary"
            placeholder="Search Dictionary"
            autoComplete="off"
            className="field-control"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </search>

      {query && items.length === 0 && <p className="text-gray-600">No entries found for “{query}”.</p>}

      {items.length > 0 && (
        <>
          <p className="text-sm text-gray-600">
            Showing {formatCount(items.length, "entry", "entries")}
            {page > 1 ? ` on page ${page}` : ""}:
          </p>
          <ul className="space-y-2">
            {items.map((entry) => (
              <li key={entry.id} className="border-b border-gray-100 pb-2">
                <Link href={entryPath(entry.slug)} className="text-lg text-blue-700 hover:underline">
                  <span lang={entry.language}>{entry.text}</span>
                </Link>
                <span className="ml-2 text-sm text-gray-600">
                  {formatLanguageName(entry.language)}
                  {entry.root && (
                    <>
                      {" · "}
                      <span lang="ar">{formatRoot(entry.root)}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Pagination
            currentPage={page}
            totalPages={hasNextPage ? page + 1 : page}
            basePath="/search"
            extraParams={{ q: query }}
          />
        </>
      )}
    </div>
  );
}
