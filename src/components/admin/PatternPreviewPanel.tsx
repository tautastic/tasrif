"use client";

import { useState } from "react";
import {
  IMPERATIVE_PERSONS,
  MOODS,
  type Mood,
  type MorphPatternRules,
  PERSONS,
  type Person,
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

interface PreviewResult {
  conjugation: { mood: string; person: string; form: string }[];
  verbalNouns: { masdar: string | null; active_participle: string | null; passive_participle: string | null };
}

interface PatternPreviewPanelProps {
  rules: MorphPatternRules;
  formNumber: number;
  noAffix: boolean;
  defaultRoot?: string;
}

const PatternPreviewPanel = ({ rules, formNumber, noAffix, defaultRoot = "كتب" }: PatternPreviewPanelProps) => {
  const [root, setRoot] = useState(defaultRoot);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const runPreview = async () => {
    setIsPending(true);
    setError(null);
    try {
      const preview = await previewMorphPatternAction({ root, rules, formNumber, noAffix });
      setResult(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview.");
      setResult(null);
    } finally {
      setIsPending(false);
    }
  };

  const cell = (mood: Mood, person: Person) =>
    result?.conjugation.find((row) => row.mood === mood && row.person === person)?.form || "—";

  return (
    <div className="space-y-3 border border-gray-200 p-3">
      <h2 className="text-lg font-semibold">Live preview</h2>
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
          {isPending ? "Generating…" : "Preview"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm" lang="ar" dir="rtl">
            <span>Masdar: {result.verbalNouns.masdar ?? "—"}</span>
            <span>Active participle: {result.verbalNouns.active_participle ?? "—"}</span>
            <span>Passive participle: {result.verbalNouns.passive_participle ?? "—"}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="text-sm" lang="ar" dir="rtl">
              <thead>
                <tr>
                  <th className="pr-2 text-left" dir="ltr">
                    Person
                  </th>
                  {MOODS.map((mood) => (
                    <th key={mood} className="px-2 text-left" dir="ltr">
                      {MOOD_LABELS[mood]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERSONS.map((person) => (
                  <tr key={person} className="border-t border-gray-100">
                    <td className="py-1 pr-2" dir="ltr">
                      {PERSON_LABELS[person]}
                    </td>
                    {MOODS.map((mood) => (
                      <td key={mood} className="px-2 py-1">
                        {mood === "imperative" && !(IMPERATIVE_PERSONS as readonly Person[]).includes(person)
                          ? ""
                          : cell(mood, person)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatternPreviewPanel;
