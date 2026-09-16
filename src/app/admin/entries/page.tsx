import Link from "next/link";
import EntryFilterSelection from "~/components/admin/EntryFilterSelection";
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
  const filter = isAdminEntryFilter(filterParam) ? filterParam : "All";
  const page = parsePageParam(pageParam);
  const { items, total } = await getLexicalEntriesForAdmin({ filter, page, limit: ENTRY_LIST_PAGE_SIZE });

  return (
    <div className="mx-auto p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Entries</h1>
      <p className="text-xs sm:text-sm text-gray-600 mb-4">{total} entries</p>

      <EntryFilterSelection value={filter} options={AdminEntryFilterOptions} />

      <table className="w-full text-left max-w-md">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500 sm:text-sm">
            <th className="py-2 pr-4 font-medium">Text</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300">
          {items.map((entry) => (
            <tr key={entry.id}>
              <td className="py-1.5 pr-2 sm:py-2 sm:pr-4 w-full">
                <Link
                  href={`/admin/entries/${entry.id}`}
                  lang={entry.language}
                  className="text-sm block truncate text-blue-600 hover:underline w-min sm:text-base"
                >
                  {entry.text}
                </Link>
              </td>
              <td className="w-full py-1.5 pr-2 sm:py-2 sm:pr-4">
                {!entry.isVerified ? (
                  <span className="block w-full text-center text-[10px] font-medium text-amber-700 bg-amber-100 px-1 py-0.5 sm:px-1.5 sm:text-xs">
                    Unverified
                  </span>
                ) : (
                  <span className="block w-full text-center text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1 py-0.5 sm:px-1.5 sm:text-xs">
                    Verified
                  </span>
                )}
              </td>
              <td className="py-1.5 sm:py-2 whitespace-nowrap text-xs sm:text-sm">
                <Link href={`/admin/edit-entry/${entry.id}`} className="text-blue-600 hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-sm text-gray-500">
                No entries found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / ENTRY_LIST_PAGE_SIZE)}
        basePath="/admin/entries"
        extraParams={{ filter }}
      />
    </div>
  );
}
