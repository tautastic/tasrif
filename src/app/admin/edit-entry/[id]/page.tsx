import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryEditForm } from "~/components/admin/entry-edit-form";
import { parseMorphologyOverrides } from "~/lib/validation/morphology";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { getLexicalEntryForEdit } from "~/server/db/repository/lexical-entry";
import { getAllMorphPatterns } from "~/server/db/repository/morph-pattern";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const entryId = await parseIdOrNotFound(params);
  const [rawEntry, patterns] = await Promise.all([getLexicalEntryForEdit(entryId), getAllMorphPatterns()]);

  if (!rawEntry) {
    notFound();
  }

  const { morphologyOverrides: rawMorphologyOverrides, ...entry } = rawEntry;

  const morphologyOverrides = parseMorphologyOverrides(rawMorphologyOverrides);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex flex-row flex-wrap gap-x-4 gap-y-1 items-baseline">
        <h1 className="text-2xl font-bold mb-4">Edit Entry</h1>
        <Link href={`/admin/entries/${entryId}`} className="text-blue-600 hover:underline text-sm">
          Preview
        </Link>
        <Link
          href={`/admin/delete-entry/${entryId}`}
          className="text-red-600 hover:underline text-sm"
          aria-label={`Delete entry ${entry.text}`}
        >
          Delete
        </Link>
      </div>
      <EntryEditForm
        mode="edit"
        morphPatternOptions={patterns}
        entry={{
          ...entry,
          morphologyOverrides,
        }}
      />
    </div>
  );
}
