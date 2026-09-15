import PaginatedEntryList from "~/components/entry/PaginatedEntryList";
import { formatRoot } from "~/lib/formatting";
import { ENTRY_LIST_PAGE_SIZE, notFoundIfEmpty, parsePageParam } from "~/lib/pagination";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getLexicalEntriesByRoot } from "~/server/db/repository/lexical-entry";

export default async function RootPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [root, { page: pageParam }] = await Promise.all([decodeSlugOrNotFound(params), searchParams]);

  const page = parsePageParam(pageParam);
  const { items, total } = await getLexicalEntriesByRoot({ root, page, limit: ENTRY_LIST_PAGE_SIZE });
  notFoundIfEmpty(total);

  return (
    <PaginatedEntryList
      heading={
        <>
          Root: <span lang="ar">{formatRoot(root)}</span>
        </>
      }
      description={`The following ${items.length} entries share this root, out of ${total} total:`}
      entries={items}
      language="ar"
      page={page}
      total={total}
      pageSize={ENTRY_LIST_PAGE_SIZE}
      basePath={`/root/${root}`}
    />
  );
}
