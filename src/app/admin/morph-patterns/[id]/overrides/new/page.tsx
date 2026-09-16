import { notFound } from "next/navigation";
import { LexicalPatternOverrideForm } from "~/components/admin/lexical-pattern-override-form";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { getMorphPatternById } from "~/server/db/repository/morph-pattern";

export default async function NewOverridePage({ params }: { params: Promise<{ id: string }> }) {
  const patternId = await parseIdOrNotFound(params);
  const pattern = await getMorphPatternById(patternId);

  if (!pattern) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">
        Add Override for{" "}
        <span lang="ar" dir="rtl">
          {pattern.vocalicTemplate}
        </span>
      </h1>
      <LexicalPatternOverrideForm
        mode="create"
        morphPatternId={patternId}
        override={{
          root: "",
          formNumber: pattern.formNumber,
          perfectVowel: pattern.perfectVowel,
          imperfectVowel: pattern.imperfectVowel,
          note: undefined,
        }}
      />
    </div>
  );
}
