import AdminEditLink from "~/components/entry/entry-page/AdminEditLink";
import { detectScriptLanguage } from "~/lib/formatting";
import { type MorphologyOverrides, parseMorphologyOverrides } from "~/lib/validation/morphology";
import type { EntryPageEntry } from "~/server/db/repository/lexical-entry";
import type { PartOfSpeechType } from "~/server/db/schema";

interface EntryHeaderProps {
  entry: EntryPageEntry;
  isPrimary?: boolean;
}

const EXTRA_FORMS = [
  { key: "dual_form", label: "dual", pos: "noun" },
  { key: "plural_form", label: "plural", pos: "noun" },
  { key: "elative_form", label: "elative", pos: "adjective" },
] as const satisfies ReadonlyArray<{ key: keyof MorphologyOverrides; label: string; pos: PartOfSpeechType }>;

const EntryHeader = ({ entry, isPrimary = false }: EntryHeaderProps) => {
  const Heading = isPrimary ? "h1" : "h2";
  const overrides = parseMorphologyOverrides(entry.morphologyOverrides);
  const availablePos = new Set(entry.senses.map((sense) => sense.pos));

  const forms = EXTRA_FORMS.flatMap(({ key, label, pos }) => {
    const value = overrides[key];
    return typeof value === "string" && availablePos.has(pos) ? [{ label, value }] : [];
  });

  return (
    <div id={`entry-${entry.id}`} className="flex items-baseline gap-2 border-b border-[#a2a9b1] pb-1 mb-3">
      <div className="flex flex-col items-baseline gap-y-1 gap-x-3 mb-2 md:flex-row">
        <Heading className="text-2xl">
          <span lang={entry.language}>{entry.text}</span>
        </Heading>
        {forms.length > 0 && (
          <div className="text-xs flex flex-row flex-wrap text-gray-700 gap-y-1.5 gap-x-4 text-nowrap md:text-base">
            {forms.map(({ label, value }) => (
              <span key={label}>
                {label}: <span lang={detectScriptLanguage(value)}>{value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <AdminEditLink entryId={entry.id} />
    </div>
  );
};

export default EntryHeader;
