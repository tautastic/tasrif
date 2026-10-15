import { notFound } from "next/navigation";
import DeleteForm from "~/components/admin/DeleteForm";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { deleteMorphPatternAction } from "~/server/actions/morph-pattern";
import { requireAdmin } from "~/server/auth/guard";
import { getMorphPatternById, getMorphPatternUsageCounts } from "~/server/db/repository/morph-pattern";

export default async function DeleteMorphPatternPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
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
          Form {formatMorphPatternFormNumber(pattern.formNumber, pattern.radicalCount)}
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

      <DeleteForm action={deleteMorphPatternAction.bind(null, patternId)} disabled={inUse} />
    </div>
  );
}
