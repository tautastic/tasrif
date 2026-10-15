"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { ActionResult } from "~/server/actions/result";

export interface AdminTableColumn {
  header: string;
  className?: string;
  hideBelowSm?: boolean;
}

export interface AdminTableRow {
  key: string | number;
  cells: ReactNode[];
  label?: string;
}

export interface AdminTableSelection {
  entityName: string;
  entityNamePlural: string;
  onDeleteSelectedAction: (ids: number[]) => Promise<ActionResult>;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const tableId = useId();
  const titleId = `${tableId}-dialog-title`;
  const descriptionId = `${tableId}-dialog-description`;

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [rows]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (showConfirm && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    } else if (!showConfirm && dialog.open) {
      dialog.close();
    }
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

  const openConfirm = () => {
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selection) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const result = await selection.onDeleteSelectedAction(Array.from(selectedKeys, Number));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelectedKeys(new Set());
      setShowConfirm(false);
    } catch {
      setError("Failed to delete the selected rows. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") {
      return;
    }
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const selectionLabelIds = (rowKey: string | number) =>
    [`${tableId}-select-${rowKey}`, `${tableId}-${rowKey}-cell-0`, `${tableId}-${rowKey}-cell-1`].join(" ");

  return (
    <div>
      {(toolbar ?? selection) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">{toolbar}</div>
          {selection && (
            <button
              type="button"
              onClick={openConfirm}
              disabled={selectedCount === 0}
              className="border border-transparent bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          )}
        </div>
      )}
      {error && !showConfirm && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500 sm:text-sm">
            {selection && (
              <th scope="col" className="w-8 py-2 pr-2">
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
                scope="col"
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
                    id={`${tableId}-select-${row.key}`}
                    type="checkbox"
                    {...(row.label
                      ? { "aria-label": `Select ${row.label}` }
                      : { "aria-label": "Select", "aria-labelledby": selectionLabelIds(row.key) })}
                    checked={selectedKeys.has(row.key)}
                    onChange={() => toggleRow(row.key)}
                  />
                </td>
              )}
              {row.cells.map((cell, index) => (
                <td
                  key={index}
                  id={selection && index < 2 ? `${tableId}-${row.key}-cell-${index}` : undefined}
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

      {selection && (
        <dialog
          ref={dialogRef}
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onClose={() => setShowConfirm(false)}
          onKeyDown={trapFocus}
          onCancel={(event) => {
            if (isDeleting) {
              event.preventDefault();
            }
          }}
          className="m-auto w-[calc(100%-2rem)] max-w-sm border border-gray-300 bg-white p-6 text-center backdrop:bg-black/50"
        >
          <h2 id={titleId} className="mb-2 text-lg font-semibold">
            Delete {selectedCount === 1 ? selection.entityName : selection.entityNamePlural}?
          </h2>
          <p id={descriptionId} className="mb-6">
            Are you sure you want to delete {selectedCount}{" "}
            {selectedCount === 1 ? selection.entityName : selection.entityNamePlural}? This cannot be undone.
          </p>
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-center space-x-4">
            <button
              ref={cancelButtonRef}
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
        </dialog>
      )}
    </div>
  );
};

export default AdminTable;
