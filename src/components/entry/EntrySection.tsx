import EntryList from "~/components/entry/EntryList";
import type { LexicalEntrySelect } from "~/server/db/schema";

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
