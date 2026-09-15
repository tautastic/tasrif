import AdminEditLink from "~/components/entry/entry-page/AdminEditLink";
import { type MorphologyOverrides, parseMorphologyOverrides } from "~/lib/validation/morphology";
import type { EntryPageEntry } from "~/server/db/repository/lexical-entry";
import type { PartOfSpeechType } from "~/server/db/schema";

interface EntryHeaderProps {
  entry: EntryPageEntry;
}

const EXTRA_FORMS = [
  { key: "dual_form", label: "dual", pos: "noun" },
  { key: "plural_form", label: "plural", pos: "noun" },
  { key: "elative_form", label: "elative", pos: "adjective" },
] as const satisfies ReadonlyArray<{ key: keyof MorphologyOverrides; label: string; pos: PartOfSpeechType }>;

const EntryHeader = ({ entry }: EntryHeaderProps) => {
  const overrides = parseMorphologyOverrides(entry.morphologyOverrides);
  const availablePos = new Set(entry.senses.map((sense) => sense.pos));

  const forms = EXTRA_FORMS.flatMap(({ key, label, pos }) => {
    const value = overrides[key];
    return typeof value === "string" && availablePos.has(pos) ? [{ label, value }] : [];
  });

  return (
    <div id={entry.text} className="flex items-baseline gap-2 border-b border-[#a2a9b1] pb-1 mb-3">
      <div className="flex flex-col items-baseline gap-y-1 gap-x-3 mb-2 md:flex-row">
        <span className="text-2xl" lang={entry.language}>
          {entry.text}
        </span>
        {forms.length > 0 && (
          <div className="text-xs flex flex-row flex-wrap text-gray-700 gap-y-1.5 gap-x-4 text-nowrap md:text-base">
            {forms.map(({ label, value }) => (
              <span key={label}>
                {label}: <span lang="ar">{value}</span>
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
