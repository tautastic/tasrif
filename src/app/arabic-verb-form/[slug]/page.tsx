import Link from "next/link";
import { notFound } from "next/navigation";
import Pagination from "~/components/Pagination";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getLexicalEntriesByFormNumber } from "~/server/db/repository/lexical-entry";

const PAGE_SIZE = 100;

export const revalidate = 3600;

export default async function ArabicVerbFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [slug, { page: pageParam }] = await Promise.all([decodeSlugOrNotFound(params), searchParams]);

  const formNumber = Number(slug);
  if (!Number.isInteger(formNumber) || formNumber < 1) {
    notFound();
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total } = await getLexicalEntriesByFormNumber({ formNumber, page, limit: PAGE_SIZE });

  if (total === 0) {
    notFound();
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Form {formatMorphPatternFormNumber(formNumber)}</h1>
      <p className="text-sm text-gray-600 mb-4">
        The following {items.length} entries are of this form, out of {total} total:
      </p>

      <ul className="grid grid-cols-3 list-disc gap-x-4 gap-y-3 pl-6 text-sm md:text-base md:grid-cols-4">
        {items.map((entry) => (
          <li key={entry.id}>
            <Link href={`/entry/${entry.normalizedText}`} className="text-blue-600 hover:underline">
              <span lang="ar">{entry.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath={`/arabic-verb-form/${slug}`} />
    </>
  );
}
