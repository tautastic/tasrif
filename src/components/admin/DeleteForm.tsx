"use client";

import { useActionState } from "react";
import CancelButton from "~/components/admin/delete-entry/CancelButton";
import type { ActionResult } from "~/server/actions/result";

interface DeleteFormProps {
  action: () => Promise<ActionResult>;
  disabled?: boolean;
}

const DeleteForm = ({ action, disabled = false }: DeleteFormProps) => {
  const [error, submit, isPending] = useActionState(async (): Promise<string | null> => {
    const result = await action();
    return result.ok ? null : result.error;
  }, null);

  return (
    <form action={submit}>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-center space-x-4">
        <button type="submit" disabled={disabled || isPending} className="btn-danger">
          {isPending ? "Deleting…" : "Delete"}
        </button>
        <CancelButton />
      </div>
    </form>
  );
};

export default DeleteForm;
