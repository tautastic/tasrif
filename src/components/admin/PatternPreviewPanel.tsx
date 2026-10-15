"use client";

import { useState } from "react";
import {
  IMPERATIVE_PERSONS,
  MOODS,
  type Mood,
  type MorphPatternRules,
  PERSONS,
  type Person,
  rulesRadicalCount,
} from "~/lib/validation/morphPatternRules";
import { previewMorphPatternAction } from "~/server/actions/morph-pattern";
import { PERSON_LABELS } from "./morph-pattern-edit-form/PersonFormsGrid";

const MOOD_LABELS: Record<Mood, string> = {
  perfect: "Perfect",
  imperative: "Imperative",
  imperfect_indicative: "Imperfect — indicative",
  imperfect_subjunctive: "Imperfect — subjunctive",
  imperfect_jussive: "Imperfect — jussive",
};

const PASSIVE_PREVIEW_MOODS: readonly Mood[] = [
  "perfect",
  "imperfect_indicative",
  "imperfect_subjunctive",
  "imperfect_jussive",
];

interface PreviewResult {
  conjugation: { mood: string; person: string; form: string }[];
  passive: { mood: string; person: string; form: string }[];
  verbalNouns: { masdar: string | null; active_participle: string | null; passive_participle: string | null };
}

interface PatternPreviewPanelProps {
  rules: MorphPatternRules;
  formNumber: number;
  noAffix: boolean;
  defaultRoot?: string;
}

const DEFAULT_ROOTS = { 3: "كتب", 4: "دحرج" } as const;

const PatternPreviewPanel = ({ rules, formNumber, noAffix, defaultRoot }: PatternPreviewPanelProps) => {
  const [typedRoot, setRoot] = useState<string | null>(null);
  const root = typedRoot ?? defaultRoot ?? DEFAULT_ROOTS[rulesRadicalCount(rules)];
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const runPreview = async () => {
    setIsPending(true);
    setError(null);
    try {
      const preview = await previewMorphPatternAction({ root, rules, formNumber, noAffix });
      if (preview.ok) {
        setResult(preview.data);
      } else {
        setError(preview.error);
        setResult(null);
      }
    } catch {
      setError("Failed to generate the preview. Please try again.");
      setResult(null);
    } finally {
      setIsPending(false);
    }
  };

  const cell = (cells: PreviewResult["conjugation"] | undefined, mood: Mood, person: Person) =>
    cells?.find((row) => row.mood === mood && row.person === person)?.form || "—";

  const scrollRegion = (label: string) => ({ role: "region", tabIndex: 0, "aria-label": label }) as const;

  const paradigmTable = (caption: string, cells: PreviewResult["conjugation"], moods: readonly Mood[]) => (
    <div className="overflow-x-auto" {...scrollRegion(caption)}>
      <table className="text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="pr-2 text-left">
              Person
            </th>
            {moods.map((mood) => (
              <th key={mood} scope="col" className="px-2 text-left">
                {MOOD_LABELS[mood]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERSONS.map((person) => (
            <tr key={person} className="border-t border-gray-100">
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                {PERSON_LABELS[person]}
              </th>
              {moods.map((mood) => (
                <td key={mood} className="px-2 py-1">
                  {mood === "imperative" && !(IMPERATIVE_PERSONS as readonly Person[]).includes(person) ? null : (
                    <span lang="ar">{cell(cells, mood, person)}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section aria-labelledby="preview-title" className="space-y-3 border border-gray-200 p-3">
      <h2 id="preview-title" className="text-lg font-semibold">
        Pattern preview
      </h2>
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="preview-root" className="mb-1 block text-sm font-medium">
            Sample root
          </label>
          <input
            id="preview-root"
            type="text"
            lang="ar"
            dir="rtl"
            className="field-control"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
          />
        </div>
        <button type="button" onClick={runPreview} disabled={isPending || !root.trim()} className="btn-secondary">
          {isPending ? "Generating…" : "Generate preview"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Masdar: <span lang="ar">{result.verbalNouns.masdar ?? "—"}</span>
            </span>
            <span>
              Active participle: <span lang="ar">{result.verbalNouns.active_participle ?? "—"}</span>
            </span>
            <span>
              Passive participle: <span lang="ar">{result.verbalNouns.passive_participle ?? "—"}</span>
            </span>
          </div>

          {paradigmTable("Conjugation preview for the sample root", result.conjugation, MOODS)}

          {result.passive.length > 0 && (
            <>
              <h3 className="text-sm font-semibold">Passive voice</h3>
              {paradigmTable("Passive voice preview for the sample root", result.passive, PASSIVE_PREVIEW_MOODS)}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default PatternPreviewPanel;
