import EntrySection from "~/components/entry/EntrySection";
import { getRandomLexicalEntries, getRecentLexicalEntries } from "~/server/db/repository/lexical-entry";

const EntryHighlights = async () => {
  const [recentEntries, randomEntries] = await Promise.all([getRecentLexicalEntries(), getRandomLexicalEntries()]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
      <EntrySection title="Recent Entries" entries={recentEntries} emptyMessage="No entries yet." />
      <EntrySection title="Random Entries" entries={randomEntries} emptyMessage="No entries yet." />
    </div>
  );
};

export default async function IndexPage() {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <EntryHighlights />
    </div>
  );
}
