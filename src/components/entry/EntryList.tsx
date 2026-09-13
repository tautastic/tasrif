import Link from "next/link";
import type { LexicalEntrySelect } from "~/server/db/schema";

interface EntryListProps {
  entries: LexicalEntrySelect[];
}

const EntryList = ({ entries }: EntryListProps) => (
  <ul className="space-y-2">
    {entries.map((entry) => (
      <li key={entry.id} className="flex items-center justify-between border-b border-gray-100 pb-2 min-w-0">
        <div className="space-x-2 min-w-0">
          <Link
            href={`/entry/${entry.normalizedText}`}
            className="text-blue-600 hover:underline text-base sm:text-lg wrap-break-word"
          >
            <span lang={entry.language}>{entry.text}</span>
          </Link>
        </div>
      </li>
    ))}
  </ul>
);

export default EntryList;
