import Link from "next/link";
import { notFound } from "next/navigation";
import ConjugationTable from "~/components/entry/ConjugationTable";
import EntryHeader from "~/components/entry/entry-page/EntryHeader";
import RootInfoBox from "~/components/entry/entry-page/RootInfoBox";
import SenseList from "~/components/entry/entry-page/SenseList";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { getLexicalEntryByIdForAdmin } from "~/server/db/repository/lexical-entry/admin";

export default async function AdminEntryPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const entryId = await parseIdOrNotFound(params);
  const preview = await getLexicalEntryByIdForAdmin(entryId);

  if (!preview) {
    notFound();
  }

  const { entry, rootInfo, language } = preview;

  return (
    <div className="mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm">
        <Link href="/admin/entries" className="text-blue-600 hover:underline">
          &larr; Back to entries
        </Link>
        {!entry.isVerified && (
          <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-1">Unverified</span>
        )}
      </div>

      <RootInfoBox rootInfo={rootInfo} />
      <div className="mb-8">
        <EntryHeader entry={entry} />
        <SenseList senses={entry.senses} language={language} />
        {entry.morphPattern && (
          <div className="mt-4 overflow-x-auto">
            <ConjugationTable
              word={entry.text}
              patternFormNumber={entry.morphPattern.formNumber}
              patternDescription={entry.morphPattern.description}
              masdar={entry.masdar}
              activeParticiple={entry.activeParticiple}
              passiveParticiple={entry.passiveParticiple}
              conjugations={entry.conjugations}
            />
          </div>
        )}
      </div>
    </div>
  );
}
