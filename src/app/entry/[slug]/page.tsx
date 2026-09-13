import { notFound } from "next/navigation";
import ConjugationTable from "~/components/entry/ConjugationTable";
import EntryHeader from "~/components/entry/entry-page/EntryHeader";
import RootInfoBox from "~/components/entry/entry-page/RootInfoBox";
import SenseList from "~/components/entry/entry-page/SenseList";
import { decodeSlugOrNotFound } from "~/lib/validation/params";
import { isAuthenticated } from "~/server/auth";
import { getLexicalEntryByNormalizedText } from "~/server/db/repository/lexical-entry";

export const revalidate = 3600;

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const isAdmin = await isAuthenticated();
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
          <div key={entry.id} className="mb-8">
            <EntryHeader entry={entry} isAdmin={isAdmin} />
            <SenseList senses={entry.senses} language={page.language} />
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
        ))}
      </div>
    </>
  );
}
