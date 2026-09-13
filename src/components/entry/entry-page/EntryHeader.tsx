import Link from "next/link";
import { type MorphologyOverrides, parseMorphologyOverrides } from "~/lib/validation/morphology";
import type { EntryPageEntry } from "~/server/db/repository/lexical-entry";
import type { PartOfSpeechType } from "~/server/db/schema";

interface EntryHeaderProps {
  entry: EntryPageEntry;
  isAdmin: boolean;
}

const EXTRA_FORMS = [
  { key: "dual_form", label: "dual", pos: "noun" },
  { key: "plural_form", label: "plural", pos: "noun" },
  { key: "elative_form", label: "elative", pos: "adjective" },
] as const satisfies ReadonlyArray<{ key: keyof MorphologyOverrides; label: string; pos: PartOfSpeechType }>;

const EntryHeader = ({ entry, isAdmin }: EntryHeaderProps) => {
  const overrides = parseMorphologyOverrides(entry.morphologyOverrides);
  const availablePos = new Set(entry.senses.map((sense) => sense.pos));

  const forms = EXTRA_FORMS.flatMap(({ key, label, pos }) => {
    const value = overrides[key];
    return typeof value === "string" && availablePos.has(pos) ? [{ label, value }] : [];
  });

  return (
    <div id={entry.text} className="flex items-baseline gap-2 border-b border-[#a2a9b1] pb-1 mb-3">
      <span className="text-2xl font-bold mb-1" lang={entry.language}>
        {entry.text}
      </span>
      {forms.length > 0 && (
        <div className="text-gray-700 mb-3 space-x-4">
          {forms.map(({ label, value }) => (
            <span key={label}>
              {label}: <span lang="ar">{value}</span>
            </span>
          ))}
        </div>
      )}
      {isAdmin && (
        <span className="text-sm ml-auto">
          <Link href={`/admin/edit-entry/${entry.id}`} className="text-blue-600 hover:underline mr-3">
            Edit
          </Link>
        </span>
      )}
    </div>
  );
};

export default EntryHeader;
