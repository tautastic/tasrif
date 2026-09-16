import { MorphPatternEditForm } from "~/components/admin/morph-pattern-edit-form";

export default function NewMorphPatternPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">Add Morphological Pattern</h1>
      <MorphPatternEditForm
        mode="create"
        pattern={{
          formNumber: 1,
          vocalicTemplate: "",
          description: "",
          rules: {},
          noAffix: false,
          isLexical: false,
          radical1Kind: "sound",
          radical2Kind: "sound",
          radical3Kind: "sound",
          isGeminate: false,
          perfectVowel: null,
          imperfectVowel: null,
        }}
      />
    </div>
  );
}
