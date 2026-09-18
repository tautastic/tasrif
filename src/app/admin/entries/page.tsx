import Link from "next/link";
import AdminBadge from "~/components/admin/AdminBadge";
import AdminTable, { type AdminTableColumn } from "~/components/admin/AdminTable";
import EntryFilterSelection from "~/components/admin/EntryFilterSelection";
import Pagination from "~/components/Pagination";
import { formatMorphPatternFormNumber, formatPartOfSpeechType, formatRoot } from "~/lib/formatting";
import { ENTRY_LIST_PAGE_SIZE, parsePageParam } from "~/lib/pagination";
import { deleteLexicalEntriesAction } from "~/server/actions/lexical-entry";
import {
  AdminEntryFilterOptions,
  type AdminEntryFilterValue,
  getLexicalEntriesForAdmin,
} from "~/server/db/repository/lexical-entry/admin";

const isAdminEntryFilter = (value: string | undefined): value is AdminEntryFilterValue =>
  value !== undefined && (AdminEntryFilterOptions as readonly string[]).includes(value);

const entryColumns: AdminTableColumn[] = [
  { header: "Text" },
  { header: "Root", hideBelowSm: true },
  { header: "Senses", hideBelowSm: true },
  { header: "Form", hideBelowSm: true },
  { header: "Status", className: "whitespace-nowrap" },
  { header: "Actions", className: "whitespace-nowrap" },
];

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

      <AdminTable
        columns={entryColumns}
        emptyMessage="No entries found."
        toolbar={<EntryFilterSelection value={filter} options={AdminEntryFilterOptions} />}
        selection={{
          entityName: "Entry",
          entityNamePlural: "Entries",
          onDeleteSelectedAction: deleteLexicalEntriesAction,
        }}
        rows={items.map((entry) => {
          const pos = [...new Set(entry.senses.map((sense) => sense.pos))];

          return {
            key: entry.id,
            cells: [
              <div key="text">
                <Link
                  href={`/admin/entries/${entry.id}`}
                  lang={entry.language}
                  className="block truncate text-base font-medium text-blue-600 hover:underline"
                >
                  {entry.text}
                </Link>
                {(entry.root || pos.length > 0) && (
                  <p className="mt-0.5 truncate text-xs text-gray-500 sm:hidden">
                    {entry.root && <span lang="ar">{formatRoot(entry.root)}</span>}
                    {entry.root && pos.length > 0 && " · "}
                    {pos.length > 0 && pos.map((p) => formatPartOfSpeechType(p)).join(", ")}
                  </p>
                )}
              </div>,
              entry.root ? (
                <span key="root" lang="ar" className="text-xs text-gray-600">
                  {formatRoot(entry.root)}
                </span>
              ) : (
                <span key="root" className="text-xs text-gray-600">
                  —
                </span>
              ),
              pos.length > 0 ? (
                <div key="senses" className="flex flex-wrap gap-1">
                  {pos.map((p) => (
                    <AdminBadge key={p}>{formatPartOfSpeechType(p)}</AdminBadge>
                  ))}
                </div>
              ) : (
                "—"
              ),
              <span key="form" className="text-xs text-gray-600">
                {entry.morphPattern ? formatMorphPatternFormNumber(entry.morphPattern.formNumber) : "—"}
              </span>,
              entry.isVerified ? (
                <AdminBadge key="status" color="emerald">
                  Verified
                </AdminBadge>
              ) : (
                <AdminBadge key="status" color="amber">
                  Unverified
                </AdminBadge>
              ),
              <div key="actions" className="flex gap-3">
                <Link href={`/admin/edit-entry/${entry.id}`} className="text-blue-600 hover:underline">
                  Edit
                </Link>
                <Link href={`/admin/delete-entry/${entry.id}`} className="text-red-600 hover:underline">
                  Delete
                </Link>
              </div>,
            ],
          };
        })}
      />

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / ENTRY_LIST_PAGE_SIZE)}
        basePath="/admin/entries"
        extraParams={{ filter }}
      />
    </div>
  );
}
