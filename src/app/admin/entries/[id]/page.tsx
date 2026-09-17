import Link from "next/link";
import { notFound } from "next/navigation";
import EntryDetail from "~/components/entry/entry-page/EntryDetail";
import RootInfoBox from "~/components/entry/entry-page/RootInfoBox";
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
      <EntryDetail entry={entry} language={language} />
    </div>
  );
}
