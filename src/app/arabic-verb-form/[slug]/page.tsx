import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "~/app/site";
import PaginatedEntryList from "~/components/entry/PaginatedEntryList";
import { formatCount, formatMorphPatternFormNumber } from "~/lib/formatting";
import {
  ENTRY_LIST_PAGE_SIZE,
  notFoundIfOutOfRange,
  parsePageParam,
  withPageParam,
  withPageTitle,
} from "~/lib/pagination";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getCachedFormPage, getCachedVerbForms } from "~/server/cache/public-queries";

type VerbFormPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const FORM_SLUG_PATTERN = /^([1-9]\d*)(q?)$/;

const parseFormSlug = (slug: string): { formNumber: number; radicalCount: 3 | 4 } => {
  const match = FORM_SLUG_PATTERN.exec(slug);
  const formNumber = Number(match?.[1]);
  if (!match || !Number.isInteger(formNumber) || formNumber < 1) {
    notFound();
  }
  return { formNumber, radicalCount: match[2] === "q" ? 4 : 3 };
};

const formSlug = (formNumber: number, radicalCount: number): string => `${formNumber}${radicalCount === 4 ? "q" : ""}`;

export const generateMetadata = async ({ params, searchParams }: VerbFormPageProps): Promise<Metadata> => {
  const [slug, { page: pageParam }] = await Promise.all([decodeSlugOrNotFound(params), searchParams]);
  const { formNumber, radicalCount } = parseFormSlug(slug);
  const page = parsePageParam(pageParam);
  const form = formatMorphPatternFormNumber(formNumber, radicalCount);
  return buildPageMetadata({
    title: withPageTitle(`Arabic Verb Form ${form}`, page),
    description: `Arabic verbs of Form ${form} in the Tasrif dictionary.`,
    path: withPageParam(`/arabic-verb-form/${formSlug(formNumber, radicalCount)}`, page),
  });
};

export default async function ArabicVerbFormPage({ params, searchParams }: VerbFormPageProps) {
  const [slug, { page: pageParam }] = await Promise.all([decodeSlugOrNotFound(params), searchParams]);

  const { formNumber, radicalCount } = parseFormSlug(slug);

  const page = parsePageParam(pageParam);
  const knownForm = (await getCachedVerbForms()).find(
    (form) => form.formNumber === formNumber && (form.radicalCount ?? 3) === radicalCount,
  );
  notFoundIfOutOfRange({ page, total: knownForm?.total ?? 0, pageSize: ENTRY_LIST_PAGE_SIZE });
  const { items, total } = await getCachedFormPage(formNumber, page, ENTRY_LIST_PAGE_SIZE, radicalCount);

  return (
    <PaginatedEntryList
      heading={`Form ${formatMorphPatternFormNumber(formNumber, radicalCount)}`}
      description={`The following ${formatCount(items.length, "entry", "entries")} ${items.length === 1 ? "is" : "are"} of this form, out of ${total} total:`}
      entries={items}
      language="ar"
      page={page}
      total={total}
      pageSize={ENTRY_LIST_PAGE_SIZE}
      basePath={`/arabic-verb-form/${formSlug(formNumber, radicalCount)}`}
    />
  );
}
