import ConjugationTable from "~/components/entry/ConjugationTable";
import EntryHeader from "~/components/entry/entry-page/EntryHeader";
import SenseList from "~/components/entry/entry-page/SenseList";
import type { EntryPageEntry } from "~/server/db/repository/lexical-entry/detail";
import type { LanguageType } from "~/server/db/schema";

interface EntryDetailProps {
  entry: EntryPageEntry;
  language: LanguageType;
}

const EntryDetail = ({ entry, language }: EntryDetailProps) => (
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
);

export default EntryDetail;
