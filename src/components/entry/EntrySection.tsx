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

interface EntrySectionProps {
  title: string;
  entries: LexicalEntrySelect[];
  emptyMessage: string;
}

const EntrySection = ({ title, entries, emptyMessage }: EntrySectionProps) => (
  <section>
    <h2 className="text-lg font-semibold mb-3">{title}</h2>
    {entries.length === 0 ? <p className="text-gray-500">{emptyMessage}</p> : <EntryList entries={entries} />}
  </section>
);

export default EntrySection;
