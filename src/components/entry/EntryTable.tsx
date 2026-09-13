import Link from "next/link";
import { formatRoot } from "~/lib/formatting";
import type { LexicalEntrySelect } from "~/server/db/schema";

interface EntryTableProps {
  entries: LexicalEntrySelect[];
  showRoot: boolean;
}

const headerClassName = "px-2 sm:px-4 py-1 sm:py-2 border-b border-gray-200";
const cellClassName = "px-2 sm:px-4 py-1 sm:py-3";

const EntryTable = ({ entries, showRoot }: EntryTableProps) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-xs sm:text-sm min-h-125">
      <thead className="bg-gray-50 text-center sm:text-left">
        <tr>
          <th className={headerClassName}>Word</th>
          {showRoot && <th className={headerClassName}>Root</th>}
          <th className={`${headerClassName} hidden sm:table-cell`}>Created</th>
          <th className={`${headerClassName} text-center`}>Actions</th>
        </tr>
      </thead>
      <tbody className="text-center sm:text-left">
        {entries.map((entry) => (
          <tr key={entry.id} className="hover:bg-gray-50 border-b border-gray-100">
            <td className={cellClassName}>
              <Link href={`/entry/${entry.normalizedText}`} className="text-blue-600 hover:underline">
                <span lang={entry.language}>{entry.text}</span>
              </Link>
            </td>
            {showRoot && (
              <td className={cellClassName}>
                {entry.root ? (
                  <>
                    <span lang="ar">{formatRoot(entry.root)}</span>
                    {entry.latinRoot && (
                      <span className="text-gray-500 text-xs ml-1">({formatRoot(entry.latinRoot)})</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            )}
            <td className={`${cellClassName} text-gray-500 text-xs hidden sm:table-cell`}>
              {entry.createdAt.toLocaleDateString("de-DE")}
            </td>
            <td className={`${cellClassName} text-center`}>
              <Link
                href={`/admin/delete-entry/${entry.id}`}
                className="text-red-600 hover:underline text-xs sm:text-sm"
              >
                Delete
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default EntryTable;
