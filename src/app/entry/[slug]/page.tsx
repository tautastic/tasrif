import { notFound } from "next/navigation";
import EntryDetail from "~/components/entry/entry-page/EntryDetail";
import RootInfoBox from "~/components/entry/entry-page/RootInfoBox";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { getLexicalEntryByNormalizedText } from "~/server/db/repository/lexical-entry";

export const revalidate = 3600;

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const decodedSlug = await decodeSlugOrNotFound(params);
  const page = await getLexicalEntryByNormalizedText(decodedSlug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <RootInfoBox rootInfo={page.rootInfo} />
      <div>
        {page.entries.map((entry) => (
          <EntryDetail key={entry.id} entry={entry} language={page.language} />
        ))}
      </div>
    </>
  );
}
