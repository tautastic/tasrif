import { notFound } from "next/navigation";
import { LexicalPatternOverrideForm } from "~/components/admin/lexical-pattern-override-form";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { getOverrideById } from "~/server/db/repository/lexical-pattern-override";
import { getMorphPatternById } from "~/server/db/repository/morph-pattern";

export default async function EditOverridePage({ params }: { params: Promise<{ id: string; overrideId: string }> }) {
  const patternId = await parseIdOrNotFound(params);
  const overrideId = await parseIdOrNotFound(params, "overrideId");
  const [pattern, override] = await Promise.all([getMorphPatternById(patternId), getOverrideById(overrideId)]);

  if (!pattern || !override || override.morphPatternId !== patternId) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">
        Edit Override for{" "}
        <span lang="ar" dir="rtl">
          {pattern.vocalicTemplate}
        </span>
      </h1>
      <LexicalPatternOverrideForm
        mode="edit"
        morphPatternId={patternId}
        override={{
          id: override.id,
          root: override.root,
          formNumber: override.formNumber,
          perfectVowel: override.perfectVowel,
          imperfectVowel: override.imperfectVowel,
          note: override.note ?? undefined,
        }}
      />
    </div>
  );
}
