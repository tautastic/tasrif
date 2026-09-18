"use client";

import { type ReactNode, useEffect, useState } from "react";

export interface AdminTableColumn {
  header: string;
  className?: string;
  hideBelowSm?: boolean;
}

export interface AdminTableRow {
  key: string | number;
  cells: ReactNode[];
}

export interface AdminTableSelection {
  entityName: string;
  entityNamePlural: string;
  onDeleteSelectedAction: (ids: number[]) => Promise<void>;
}

interface AdminTableProps {
  columns: AdminTableColumn[];
  rows: AdminTableRow[];
  emptyMessage: string;
  toolbar?: ReactNode;
  selection?: AdminTableSelection;
}

const AdminTable = ({ columns, rows, emptyMessage, toolbar, selection }: AdminTableProps) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [rows]);

  useEffect(() => {
    if (!showConfirm) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowConfirm(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showConfirm]);

  const allSelected = rows.length > 0 && rows.every((row) => selectedKeys.has(row.key));
  const someSelected = selectedKeys.size > 0 && !allSelected;
  const selectedCount = selectedKeys.size;

  const toggleAll = () => {
    setSelectedKeys(allSelected ? new Set() : new Set(rows.map((row) => row.key)));
  };

  const toggleRow = (key: string | number) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (!selection) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await selection.onDeleteSelectedAction(Array.from(selectedKeys, Number));
      setSelectedKeys(new Set());
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected rows.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {(toolbar ?? selection) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">{toolbar}</div>
          {selection && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={selectedCount === 0}
              className="border border-transparent bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          )}
        </div>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500 sm:text-sm">
            {selection && (
              <th className="w-8 py-2 pr-2">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someSelected;
                    }
                  }}
                  onChange={toggleAll}
                />
              </th>
            )}
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
              {selection && (
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    aria-label={`Select row ${row.key}`}
                    checked={selectedKeys.has(row.key)}
                    onChange={() => toggleRow(row.key)}
                  />
                </td>
              )}
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
              <td colSpan={columns.length + (selection ? 1 : 0)} className="py-4 text-sm text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selection && showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative mx-4 w-full max-w-sm border border-gray-300 bg-white p-6 text-center">
            <p className="mb-6">
              Are you sure you want to delete {selectedCount}{" "}
              {selectedCount === 1 ? selection.entityName : selection.entityNamePlural}?
            </p>
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={isDeleting} className="btn-danger">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTable;
