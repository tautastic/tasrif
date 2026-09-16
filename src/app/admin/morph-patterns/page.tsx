import Link from "next/link";
import MorphPatternFilterSelection from "~/components/admin/MorphPatternFilterSelection";
import Pagination from "~/components/Pagination";
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

      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500 sm:text-sm">
            <th className="py-2 pr-4 font-medium">Form</th>
            <th className="py-2 pr-4 font-medium">Template</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 pr-4 font-medium">Flags</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300">
          {items.map((pattern) => (
            <tr key={pattern.id}>
              <td className="py-2 pr-4 text-sm">{pattern.formNumber}</td>
              <td className="py-2 pr-4 text-sm" lang="ar" dir="rtl">
                <Link href={`/admin/morph-patterns/${pattern.id}`} className="text-blue-600 hover:underline">
                  {pattern.vocalicTemplate}
                </Link>
              </td>
              <td className="py-2 pr-4 text-sm">{pattern.description || "—"}</td>
              <td className="py-2 pr-4 text-xs whitespace-nowrap">
                {pattern.isLexical && <span className="mr-1 bg-purple-100 px-1.5 py-0.5 text-purple-700">Lexical</span>}
                {pattern.noAffix && <span className="bg-amber-100 px-1.5 py-0.5 text-amber-700">No-affix</span>}
              </td>
              <td className="py-2 text-sm whitespace-nowrap">
                <Link href={`/admin/morph-patterns/${pattern.id}/edit`} className="text-blue-600 hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-sm text-gray-500">
                No patterns found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
