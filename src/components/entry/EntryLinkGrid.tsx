import Link from "next/link";
import { entryPath } from "~/lib/formatting";
import type { LanguageType } from "~/server/db/schema";

interface EntryLinkGridEntry {
  id: number;
  text: string;
  slug: string;
}

interface EntryLinkGridProps {
  entries: EntryLinkGridEntry[];
  language: LanguageType;
}

const EntryLinkGrid = ({ entries, language }: EntryLinkGridProps) => (
  <ul className="grid grid-cols-2 list-disc gap-x-4 gap-y-3 pl-6 text-sm sm:grid-cols-3 md:text-base md:grid-cols-4">
    {entries.map((entry) => (
      <li key={entry.id}>
        <Link prefetch={false} href={entryPath(entry.slug)} className="text-blue-600 hover:underline">
          <span lang={language}>{entry.text}</span>
        </Link>
      </li>
    ))}
  </ul>
);

export default EntryLinkGrid;
