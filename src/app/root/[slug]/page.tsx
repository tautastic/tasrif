import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRoot } from "~/lib/formatting";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getLexicalEntriesByRoot } from "~/server/db/repository/lexical-entry";

export const revalidate = 3600;

export default async function RootPage({ params }: { params: Promise<{ slug: string }> }) {
  const root = await decodeSlugOrNotFound(params);
  const entries = await getLexicalEntriesByRoot(root);

  if (entries.length === 0) {
    notFound();
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">
        Root: <span lang="ar">{formatRoot(root)}</span>
      </h1>
      <p className="text-gray-700 mb-2">Entries with this root:</p>
      <ul className="list-disc pl-5 space-y-1">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link href={`/entry/${entry.normalizedText}`} className="text-blue-600 hover:underline">
              <span lang="ar">{entry.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
