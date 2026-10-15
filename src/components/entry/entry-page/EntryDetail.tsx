import ConjugationTable from "~/components/entry/ConjugationTable";
import EntryHeader from "~/components/entry/entry-page/EntryHeader";
import SenseList from "~/components/entry/entry-page/SenseList";
import type { EntryPageEntry } from "~/server/db/repository/lexical-entry/detail";
import type { LanguageType } from "~/server/db/schema";

interface EntryDetailProps {
  entry: EntryPageEntry;
  language: LanguageType;
  isPrimary?: boolean;
}

const EntryDetail = ({ entry, language, isPrimary = false }: EntryDetailProps) => (
  <div className="mb-8">
    <EntryHeader entry={entry} isPrimary={isPrimary} />
    <SenseList senses={entry.senses} language={language} />
    {entry.morphPattern && (
      <div className="mt-4">
        <ConjugationTable
          word={entry.text}
          patternFormNumber={entry.morphPattern.formNumber}
          patternRadicalCount={entry.morphPattern.radicalCount}
          patternDescription={entry.morphPattern.description}
          masdar={entry.masdar}
          activeParticiple={entry.activeParticiple}
          passiveParticiple={entry.passiveParticiple}
          conjugations={entry.conjugations}
          alternatives={entry.alternatives}
          passiveAlternatives={entry.passiveAlternatives}
          alternativeNouns={entry.alternativeNouns}
        />
      </div>
    )}
  </div>
);

export default EntryDetail;
