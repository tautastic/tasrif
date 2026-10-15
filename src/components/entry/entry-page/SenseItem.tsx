import Link from "next/link";
import { detectScriptLanguage, entryPath, formatPartOfSpeechType, formatSenseRelationType } from "~/lib/formatting";
import type { EntryPageSense } from "~/server/db/repository/lexical-entry";
import type { LanguageType } from "~/server/db/schema";

interface SenseItemProps {
  sense: EntryPageSense;
  language: LanguageType;
}

interface LinkedSense {
  senseId: number;
  slug: string;
  text: string;
  qualifier?: string;
  note?: string | null;
}

const LinkedSenseList = ({ title, items }: { title: string; items: LinkedSense[] }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-1">
      <span className="text-sm text-gray-600">{title}:</span>
      <ul className="list-disc ml-6 text-sm">
        {items.map((item) => (
          <li key={`${item.senseId}-${item.qualifier ?? ""}`}>
            <Link
              href={`${entryPath(item.slug)}#sense-${item.senseId}`}
              className="text-blue-600 underline hover:text-blue-800"
            >
              <span lang={detectScriptLanguage(item.text)}>{item.text}</span>
            </Link>
            {item.qualifier && <span className="text-gray-600"> ({item.qualifier})</span>}
            {item.note && <span className="text-gray-600"> – {item.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const SenseItem = ({ sense, language }: SenseItemProps) => (
  <div id={`sense-${sense.id}`} className="scroll-mt-4 target:bg-yellow-50">
    <span className="text-sm font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5">
      {formatPartOfSpeechType(sense.pos)}
    </span>

    {sense.definitions.length > 0 && (
      <ol className="list-decimal ml-6 mt-1 space-y-0.5 text-base">
        {sense.definitions.map((definition, index) => (
          <li key={index}>
            <span lang={detectScriptLanguage(definition)}>{definition}</span>
          </li>
        ))}
      </ol>
    )}

    {sense.contextTags.length > 0 && (
      <ul aria-label="Context" className="mt-1 ml-6 flex flex-wrap gap-1">
        {sense.contextTags.map((tag) => (
          <li key={tag} lang={detectScriptLanguage(tag)} className="bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
            {tag}
          </li>
        ))}
      </ul>
    )}

    {sense.examples.length > 0 && (
      <>
        <div className="mt-2">
          <span className="font-medium text-sm text-gray-700">Examples:</span>
        </div>
        <ul className="list-disc ml-4 w-fit sm:ml-12 space-y-1 mt-1 text-sm max-w-md leading-loose" lang={language}>
          {sense.examples.map((example, index) => (
            <li key={index}>{example}</li>
          ))}
        </ul>
      </>
    )}

    <LinkedSenseList
      title="Related"
      items={sense.relatedSenses.map((relation) => ({
        senseId: relation.targetSenseId,
        slug: relation.targetSlug,
        text: relation.targetText,
        qualifier: formatSenseRelationType(relation.relationType),
        note: relation.contextNote,
      }))}
    />

    <LinkedSenseList
      title="Translations"
      items={sense.translations.map((translation) => ({
        senseId: translation.targetSenseId,
        slug: translation.targetSlug,
        text: translation.targetText,
        qualifier: translation.domain ?? undefined,
        note: translation.note,
      }))}
    />
  </div>
);

export default SenseItem;
