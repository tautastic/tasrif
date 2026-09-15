import Link from "next/link";
import { connection } from "next/server";
import EntrySection from "~/components/entry/EntrySection";
import { getRandomLexicalEntries, getRecentLexicalEntries } from "~/server/db/repository/lexical-entry";

const BROWSE_LINKS = [
  { href: "/lang/ar", label: "Arabic entries" },
  { href: "/lang/en", label: "English entries" },
  { href: "/arabic-verb-form", label: "Arabic verb forms" },
] as const;

const EntryHighlights = async () => {
  await connection();
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
    <div className="mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <p className="text-sm">
        Browse:{" "}
        {BROWSE_LINKS.map(({ href, label }, index) => (
          <span key={href}>
            {index > 0 && " · "}
            <Link href={href} className="text-blue-600 hover:underline">
              {label}
            </Link>
          </span>
        ))}
      </p>
      <EntryHighlights />
    </div>
  );
}
