import Link from "next/link";
import AdminBadge from "~/components/admin/AdminBadge";
import AdminTable, { type AdminTableColumn } from "~/components/admin/AdminTable";
import MorphPatternFilterSelection from "~/components/admin/MorphPatternFilterSelection";
import Pagination from "~/components/Pagination";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { MORPH_PATTERN_LIST_PAGE_SIZE, parsePageParam } from "~/lib/pagination";
import {
  listMorphPatternsForAdmin,
  MorphPatternLexicalFilterOptions,
  type MorphPatternLexicalFilterValue,
} from "~/server/db/repository/morph-pattern";

const isLexicalFilterValue = (value: string | undefined): value is MorphPatternLexicalFilterValue =>
  value !== undefined && (MorphPatternLexicalFilterOptions as readonly string[]).includes(value);

const parseFormNumberParam = (value: string | undefined): number | undefined => {
  if (value === undefined || !/^([1-9]|10)$/.test(value)) {
    return undefined;
  }
  return Number(value);
};

const morphPatternColumns: AdminTableColumn[] = [
  { header: "Form" },
  { header: "Template" },
  { header: "Description" },
  { header: "Flags", className: "whitespace-nowrap" },
  { header: "Actions", className: "whitespace-nowrap" },
];

export default async function MorphPatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; formNumber?: string; lexicalFilter?: string }>;
}) {
  const { page: pageParam, formNumber: formNumberParam, lexicalFilter: lexicalFilterParam } = await searchParams;
  const lexicalFilter = isLexicalFilterValue(lexicalFilterParam) ? lexicalFilterParam : "All";
  const formNumber = parseFormNumberParam(formNumberParam);
  const page = parsePageParam(pageParam);

  const { items, total } = await listMorphPatternsForAdmin({
    formNumber,
    lexicalFilter,
    page,
    limit: MORPH_PATTERN_LIST_PAGE_SIZE,
  });

  return (
    <div className="mx-auto p-4 sm:p-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">Morphological Patterns</h1>
        <Link href="/admin/morph-patterns/new" className="text-sm text-blue-600 hover:underline">
          Add Pattern
        </Link>
      </div>
      <p className="mb-4 text-xs text-gray-600 sm:text-sm">{total} patterns</p>

      <MorphPatternFilterSelection
        formNumber={formNumber}
        lexicalFilter={lexicalFilter}
        lexicalFilterOptions={MorphPatternLexicalFilterOptions}
      />

      <AdminTable
        columns={morphPatternColumns}
        emptyMessage="No patterns found."
        rows={items.map((pattern) => ({
          key: pattern.id,
          cells: [
            formatMorphPatternFormNumber(pattern.formNumber),
            <span key="template" lang="ar" dir="rtl">
              <Link href={`/admin/morph-patterns/${pattern.id}`} className="text-blue-600 hover:underline">
                {pattern.vocalicTemplate}
              </Link>
            </span>,
            pattern.description || "—",
            <div key="flags" className="flex flex-wrap gap-1">
              {pattern.isLexical && <AdminBadge color="purple">Lexical</AdminBadge>}
              {pattern.noAffix && <AdminBadge color="amber">No-affix</AdminBadge>}
            </div>,
            <Link
              key="edit"
              href={`/admin/morph-patterns/${pattern.id}/edit`}
              className="text-blue-600 hover:underline"
            >
              Edit
            </Link>,
          ],
        }))}
      />

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / MORPH_PATTERN_LIST_PAGE_SIZE)}
        basePath="/admin/morph-patterns"
        extraParams={{
          ...(formNumber !== undefined ? { formNumber: String(formNumber) } : {}),
          ...(lexicalFilter !== "All" ? { lexicalFilter } : {}),
        }}
      />
    </div>
  );
}
