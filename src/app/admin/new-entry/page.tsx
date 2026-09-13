import { EntryEditForm } from "~/components/admin/entry-edit-form";
import { getAllMorphPatterns } from "~/server/db/repository/morph-pattern";

export default async function NewEntryPage() {
  const patterns = await getAllMorphPatterns();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Add Entry</h1>
      <EntryEditForm
        mode="create"
        morphPatternOptions={patterns}
        entry={{
          language: "en",
          text: "",
          root: null,
          morphPatternId: null,
          senses: [],
          morphologyOverrides: null,
        }}
      />
    </div>
  );
}
