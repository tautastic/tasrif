import { notFound } from "next/navigation";
import { MorphPatternEditForm } from "~/components/admin/morph-pattern-edit-form";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { getMorphPatternById } from "~/server/db/repository/morph-pattern";

export default async function EditMorphPatternPage({ params }: { params: Promise<{ id: string }> }) {
  const patternId = await parseIdOrNotFound(params);
  const pattern = await getMorphPatternById(patternId);

  if (!pattern) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">Edit Morphological Pattern</h1>
      <MorphPatternEditForm
        mode="edit"
        pattern={{
          id: pattern.id,
          formNumber: pattern.formNumber,
          vocalicTemplate: pattern.vocalicTemplate,
          description: pattern.description,
          rules: pattern.rules,
          noAffix: pattern.noAffix,
          isLexical: pattern.isLexical,
          radical1Kind: pattern.radical1Kind,
          radical2Kind: pattern.radical2Kind,
          radical3Kind: pattern.radical3Kind,
          isGeminate: pattern.isGeminate,
          perfectVowel: pattern.perfectVowel,
          imperfectVowel: pattern.imperfectVowel,
        }}
      />
    </div>
  );
}
