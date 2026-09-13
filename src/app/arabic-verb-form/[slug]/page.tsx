import { notFound } from "next/navigation";
import PaginatedEntryList from "~/components/entry/PaginatedEntryList";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { ENTRY_LIST_PAGE_SIZE, notFoundIfEmpty, parsePageParam } from "~/lib/pagination";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getLexicalEntriesByFormNumber } from "~/server/db/repository/lexical-entry";

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

  const page = parsePageParam(pageParam);
  const { items, total } = await getLexicalEntriesByFormNumber({ formNumber, page, limit: ENTRY_LIST_PAGE_SIZE });
  notFoundIfEmpty(total);

  return (
    <PaginatedEntryList
      heading={`Form ${formatMorphPatternFormNumber(formNumber)}`}
      description={`The following ${items.length} entries are of this form, out of ${total} total:`}
      entries={items}
      language="ar"
      page={page}
      total={total}
      pageSize={ENTRY_LIST_PAGE_SIZE}
      basePath={`/arabic-verb-form/${slug}`}
    />
  );
}
