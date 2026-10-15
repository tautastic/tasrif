import type { Metadata } from "next";
import { buildPageMetadata } from "~/app/site";
import PaginatedEntryList from "~/components/entry/PaginatedEntryList";
import { formatCount, formatRoot, rootPath } from "~/lib/formatting";
import {
  ENTRY_LIST_PAGE_SIZE,
  notFoundIfOutOfRange,
  parsePageParam,
  withPageParam,
  withPageTitle,
} from "~/lib/pagination";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getLexicalEntriesByRoot } from "~/server/db/repository/lexical-entry";

type RootPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export const generateMetadata = async ({ params, searchParams }: RootPageProps): Promise<Metadata> => {
  const [root, { page: pageParam }] = await Promise.all([decodeSlugOrNotFound(params), searchParams]);
  const page = parsePageParam(pageParam);
  return buildPageMetadata({
    title: withPageTitle(`Root ${formatRoot(root)}`, page),
    description: `Arabic dictionary entries derived from the root ${formatRoot(root)}.`,
    path: withPageParam(rootPath(root), page),
  });
};

export default async function RootPage({ params, searchParams }: RootPageProps) {
  const [root, { page: pageParam }] = await Promise.all([decodeSlugOrNotFound(params), searchParams]);

  const page = parsePageParam(pageParam);
  const { items, total } = await getLexicalEntriesByRoot({ root, page, limit: ENTRY_LIST_PAGE_SIZE });
  notFoundIfOutOfRange({ page, total, pageSize: ENTRY_LIST_PAGE_SIZE });

  return (
    <PaginatedEntryList
      heading={
        <>
          Root: <span lang="ar">{formatRoot(root)}</span>
        </>
      }
      description={`The following ${formatCount(items.length, "entry", "entries")} ${items.length === 1 ? "shares" : "share"} this root, out of ${total} total:`}
      entries={items}
      language="ar"
      page={page}
      total={total}
      pageSize={ENTRY_LIST_PAGE_SIZE}
      basePath={rootPath(root)}
    />
  );
}
