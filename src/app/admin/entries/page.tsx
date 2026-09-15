import Link from "next/link";
import Pagination from "~/components/Pagination";
import { ENTRY_LIST_PAGE_SIZE, parsePageParam } from "~/lib/pagination";
import {
  AdminEntryFilterOptions,
  type AdminEntryFilterValue,
  getLexicalEntriesForAdmin,
} from "~/server/db/repository/lexical-entry/admin";

const isAdminEntryFilter = (value: string | undefined): value is AdminEntryFilterValue =>
  value !== undefined && (AdminEntryFilterOptions as readonly string[]).includes(value);

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { page: pageParam, filter: filterParam } = await searchParams;
  const filter = isAdminEntryFilter(filterParam) ? filterParam : "Unverified";
  const page = parsePageParam(pageParam);
  const { items, total } = await getLexicalEntriesForAdmin({ filter, page, limit: ENTRY_LIST_PAGE_SIZE });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Entries</h1>
      <p className="text-sm text-gray-600 mb-4">{total} entries</p>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        {AdminEntryFilterOptions.map((f) => (
          <Link
            key={f}
            href={`/admin/entries?filter=${f}`}
            className={`px-3 py-1 rounded border ${
              f === filter ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <ul className="divide-y divide-gray-100">
        {items.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span lang={entry.language} className="truncate">
                {entry.text}
              </span>
              {!entry.isVerified && (
                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm shrink-0">
                  Unverified
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 text-sm">
              <Link href={`/admin/entries/${entry.id}`} className="text-blue-600 hover:underline">
                Preview
              </Link>
              <Link href={`/admin/edit-entry/${entry.id}`} className="text-blue-600 hover:underline">
                Edit
              </Link>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="py-4 text-sm text-gray-500">No entries found.</li>}
      </ul>

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / ENTRY_LIST_PAGE_SIZE)}
        basePath="/admin/entries"
        extraParams={{ filter }}
      />
    </div>
  );
}
