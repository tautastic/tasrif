import { EntryEditForm } from "~/components/admin/entry-edit-form";

export default function NewEntryPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Add Entry</h1>
      <EntryEditForm
        mode="create"
        entry={{
          language: "en",
          text: "",
          root: null,
          verbFormChoice: null,
          senses: [],
          morphologyOverrides: null,
        }}
      />
    </div>
  );
}
