import type { ReactNode } from "react";
import EntryLinkGrid from "~/components/entry/EntryLinkGrid";
import Pagination from "~/components/Pagination";
import type { LanguageType } from "~/server/db/schema";

interface PaginatedEntryListEntry {
  id: number;
  text: string;
  normalizedText: string;
}

interface PaginatedEntryListProps {
  heading: ReactNode;
  description: string;
  entries: PaginatedEntryListEntry[];
  language: LanguageType;
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
}

const PaginatedEntryList = ({
  heading,
  description,
  entries,
  language,
  page,
  total,
  pageSize,
  basePath,
}: PaginatedEntryListProps) => (
  <>
    <h1 className="text-2xl font-bold mb-2">{heading}</h1>
    <p className="text-sm text-gray-600 mb-4">{description}</p>

    <EntryLinkGrid entries={entries} language={language} />
    <Pagination currentPage={page} totalPages={Math.ceil(total / pageSize)} basePath={basePath} />
  </>
);

export default PaginatedEntryList;
