import { notFound } from "next/navigation";
import DeleteForm from "~/components/admin/DeleteForm";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { deleteOverrideAction } from "~/server/actions/lexical-pattern-override";
import { requireAdmin } from "~/server/auth/guard";
import { getOverrideById } from "~/server/db/repository/lexical-pattern-override";

export default async function DeleteOverridePage({ params }: { params: Promise<{ id: string; overrideId: string }> }) {
  await requireAdmin();
  const patternId = await parseIdOrNotFound(params);
  const overrideId = await parseIdOrNotFound(params, "overrideId");
  const override = await getOverrideById(overrideId);

  if (!override || override.morphPatternId !== patternId) {
    notFound();
  }

  return (
    <div className="mx-auto mt-10 max-w-lg border border-gray-300 p-6 text-center">
      <h1 className="mb-4 text-2xl font-bold">Delete Override</h1>

      <p className="mb-2">Are you sure you want to delete this override?</p>

      <div className="my-4">
        <div className="text-2xl text-red-700" lang="ar" dir="rtl">
          {override.root}
        </div>
        <div className="text-sm text-gray-600">
          Form {formatMorphPatternFormNumber(override.formNumber)}
          {override.variant ? `, variant ${override.variant}` : ""}
        </div>
      </div>

      <p className="mb-6 text-sm text-gray-600">This action cannot be undone.</p>

      <DeleteForm action={deleteOverrideAction.bind(null, patternId, overrideId)} />
    </div>
  );
}
