import { notFound } from "next/navigation";
import CancelButton from "~/components/admin/delete-entry/CancelButton";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { deleteMorphPatternAction } from "~/server/actions/morph-pattern";
import { getMorphPatternById, getMorphPatternUsageCounts } from "~/server/db/repository/morph-pattern";

export default async function DeleteMorphPatternPage({ params }: { params: Promise<{ id: string }> }) {
  const patternId = await parseIdOrNotFound(params);
  const pattern = await getMorphPatternById(patternId);

  if (!pattern) {
    notFound();
  }

  const { entryCount, overrideCount } = await getMorphPatternUsageCounts(patternId);
  const inUse = entryCount > 0 || overrideCount > 0;

  return (
    <div className="mx-auto mt-10 max-w-lg border border-gray-300 p-6 text-center">
      <h1 className="mb-4 text-2xl font-bold">Delete Pattern</h1>

      <p className="mb-2">Are you sure you want to delete this pattern?</p>

      <div className="my-4">
        <div className="text-2xl text-red-700" lang="ar" dir="rtl">
          {pattern.vocalicTemplate}
        </div>
        <div className="text-sm text-gray-600">
          Form {formatMorphPatternFormNumber(pattern.formNumber)}
          {pattern.description ? ` — ${pattern.description}` : ""}
        </div>
      </div>

      {inUse ? (
        <p className="mb-6 text-sm text-red-600">
          Cannot delete: still referenced by {entryCount} {entryCount === 1 ? "entry" : "entries"} and {overrideCount}{" "}
          {overrideCount === 1 ? "override" : "overrides"}. Repoint or remove those first.
        </p>
      ) : (
        <p className="mb-6 text-sm text-gray-600">This action cannot be undone.</p>
      )}

      <form action={deleteMorphPatternAction.bind(null, patternId)}>
        <div className="flex justify-center space-x-4">
          <button type="submit" disabled={inUse} className="btn-danger">
            Delete
          </button>
          <CancelButton />
        </div>
      </form>
    </div>
  );
}
