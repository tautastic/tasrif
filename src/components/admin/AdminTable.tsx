import type { ReactNode } from "react";

export interface AdminTableColumn {
  header: string;
  className?: string;
  hideBelowSm?: boolean;
}

export interface AdminTableRow {
  key: string | number;
  cells: ReactNode[];
}

interface AdminTableProps {
  columns: AdminTableColumn[];
  rows: AdminTableRow[];
  emptyMessage: string;
}

const AdminTable = ({ columns, rows, emptyMessage }: AdminTableProps) => (
  <table className="w-full text-left text-sm">
    <thead>
      <tr className="border-b border-gray-200 text-xs text-gray-500 sm:text-sm">
        {columns.map((column, index) => (
          <th
            key={column.header}
            className={`py-2 font-medium ${index < columns.length - 1 ? "pr-4" : ""} ${column.hideBelowSm ? "hidden sm:table-cell" : ""} ${column.className ?? ""}`}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-300">
      {rows.map((row) => (
        <tr key={row.key}>
          {row.cells.map((cell, index) => (
            <td
              key={index}
              className={`py-2 ${index < row.cells.length - 1 ? "pr-4" : ""} ${columns[index]?.hideBelowSm ? "hidden sm:table-cell" : ""} ${columns[index]?.className ?? ""}`}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
      {rows.length === 0 && (
        <tr>
          <td colSpan={columns.length} className="py-4 text-sm text-gray-500">
            {emptyMessage}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export default AdminTable;
