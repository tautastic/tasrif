import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SITE_DESCRIPTION } from "~/app/site";
import EntrySection from "~/components/entry/EntrySection";
import { getCachedRandomEntries, getCachedRecentEntries } from "~/server/cache/public-queries";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const BROWSE_LINKS = [
  { href: "/lang/ar", label: "Arabic entries" },
  { href: "/lang/en", label: "English entries" },
  { href: "/arabic-verb-form", label: "Arabic verb forms" },
] as const;

const EntryHighlights = async () => {
  await connection();
  const [recentEntries, randomEntries] = await Promise.all([getCachedRecentEntries(), getCachedRandomEntries()]);

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
      <h1 className="text-xl font-semibold">{SITE_DESCRIPTION}</h1>
      <p className="text-sm">
        Browse:{" "}
        {BROWSE_LINKS.map(({ href, label }, index) => (
          <span key={href}>
            {index > 0 && " · "}
            <Link href={href} className="text-blue-600 underline hover:text-blue-800">
              {label}
            </Link>
          </span>
        ))}
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-gray-600" role="status">
            Loading entries…
          </p>
        }
      >
        <EntryHighlights />
      </Suspense>
    </div>
  );
}
