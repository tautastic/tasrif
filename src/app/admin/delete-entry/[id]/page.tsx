import { notFound } from "next/navigation";
import DeleteForm from "~/components/admin/DeleteForm";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { deleteLexicalEntryAction } from "~/server/actions/lexical-entry";
import { requireAdmin } from "~/server/auth/guard";
import { getLexicalEntrySummary } from "~/server/db/repository/lexical-entry";

export default async function DeleteEntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const entryId = await parseIdOrNotFound(params);
  const entry = await getLexicalEntrySummary(entryId);

  if (!entry) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 border border-gray-300 text-center">
      <h1 className="text-2xl font-bold mb-4">Delete Entry</h1>

      <p className="mb-2">Are you sure you want to delete this entry?</p>

      <div className="my-4">
        <div className="text-2xl text-red-700" lang={entry.language}>
          {entry.text}
        </div>
      </div>

      <p className="mb-6 text-sm text-gray-600">This action cannot be undone.</p>

      <DeleteForm action={deleteLexicalEntryAction.bind(null, entryId)} />
    </div>
  );
}
