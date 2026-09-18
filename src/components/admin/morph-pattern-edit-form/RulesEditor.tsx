"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Field } from "~/components/ui/Field";
import {
  IMPERATIVE_PERSONS,
  IMPERFECT_MOOD_KEYS,
  type Mood,
  type MorphPatternRules,
  PERSONS,
  type Person,
  STRING_KEYS,
} from "~/lib/validation/morphPatternRules";
import PersonFormsGrid from "./PersonFormsGrid";
import { toDisplayTemplate, toRawTemplate } from "./radicalPlaceholders";
import type { MorphPatternFormInput, MorphPatternFormValues } from "./schema";

type RulesRecord = Record<string, string | Partial<Record<Person, string>> | undefined>;
type MoodValue = string | Partial<Record<Person, string>> | undefined;

const STRING_KEY_LABELS: Record<(typeof STRING_KEYS)[number], string> = {
  masdar: "Masdar (verbal noun)",
  active_participle: "Active participle",
  passive_participle: "Passive participle",
};

const MOOD_LABELS: Record<Mood, string> = {
  perfect: "Perfect",
  imperative: "Imperative",
  imperfect_indicative: "Imperfect — indicative",
  imperfect_subjunctive: "Imperfect — subjunctive",
  imperfect_jussive: "Imperfect — jussive",
};

const MoodSection = ({
  moodKey,
  value,
  persons,
  forceGrid,
  onChange,
}: {
  moodKey: Mood;
  value: MoodValue;
  persons: readonly Person[];
  forceGrid: boolean;
  onChange: (next: MoodValue) => void;
}) => {
  const isGrid = forceGrid || typeof value === "object";

  return (
    <div className="border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{MOOD_LABELS[moodKey]}</span>
        {!forceGrid && (
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={isGrid} onChange={(e) => onChange(e.target.checked ? {} : "")} />
            Per-person
          </label>
        )}
      </div>
      {isGrid ? (
        <PersonFormsGrid
          idPrefix={`rules-${moodKey}`}
          persons={persons}
          value={typeof value === "object" ? value : undefined}
          onChange={onChange}
        />
      ) : (
        <input
          type="text"
          lang="ar"
          dir="rtl"
          className="field-control"
          value={toDisplayTemplate(typeof value === "string" ? value : "")}
          onChange={(e) => onChange(toRawTemplate(e.target.value))}
        />
      )}
    </div>
  );
};

const collectErrorMessages = (node: unknown, acc: string[] = []): string[] => {
  if (!node || typeof node !== "object") {
    return acc;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.message === "string") {
    acc.push(record.message);
  }
  for (const [key, child] of Object.entries(record)) {
    if (key !== "message" && key !== "type" && key !== "ref") {
      collectErrorMessages(child, acc);
    }
  }
  return acc;
};

const RulesEditor = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<MorphPatternFormInput, unknown, MorphPatternFormValues>();
  const noAffix = useWatch({ control, name: "noAffix" }) ?? false;
  const ruleErrors = collectErrorMessages(errors.rules);

  return (
    <Controller
      name="rules"
      control={control}
      render={({ field }) => {
        const rules = (field.value ?? {}) as MorphPatternRules;
        const usesStem = !noAffix && rules.imperfect_stem !== undefined;

        const setKey = (key: string, value: string | Partial<Record<Person, string>> | undefined) => {
          const next: RulesRecord = { ...(rules as RulesRecord) };
          if (value === undefined || value === "") {
            delete next[key];
          } else {
            next[key] = value;
          }
          field.onChange(next as MorphPatternRules);
        };

        const switchToStem = () => {
          const next: RulesRecord = { ...(rules as RulesRecord), imperfect_stem: "" };
          for (const mood of IMPERFECT_MOOD_KEYS) {
            delete next[mood];
          }
          field.onChange(next as MorphPatternRules);
        };

        const switchToExplicitMoods = () => {
          const next: RulesRecord = { ...(rules as RulesRecord) };
          delete next.imperfect_stem;
          field.onChange(next as MorphPatternRules);
        };

        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Rules</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {STRING_KEYS.map((key) => (
                <Field key={key} id={`rules-${key}`} label={STRING_KEY_LABELS[key]}>
                  <input
                    id={`rules-${key}`}
                    type="text"
                    lang="ar"
                    dir="rtl"
                    className="field-control"
                    value={toDisplayTemplate(rules[key] ?? "")}
                    onChange={(e) => setKey(key, toRawTemplate(e.target.value))}
                  />
                </Field>
              ))}
            </div>

            <MoodSection
              moodKey="perfect"
              value={rules.perfect}
              persons={PERSONS}
              forceGrid={noAffix}
              onChange={(next) => setKey("perfect", next)}
            />
            <MoodSection
              moodKey="imperative"
              value={rules.imperative}
              persons={IMPERATIVE_PERSONS}
              forceGrid={noAffix}
              onChange={(next) => setKey("imperative", next)}
            />

            <div className="border border-gray-200 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium">Imperfect</span>
                {!noAffix && (
                  <>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="radio" name="imperfect-mode" checked={usesStem} onChange={switchToStem} />
                      Regular affixation from a stem
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="radio" name="imperfect-mode" checked={!usesStem} onChange={switchToExplicitMoods} />
                      Spell out each mood
                    </label>
                  </>
                )}
              </div>

              {usesStem ? (
                <input
                  type="text"
                  lang="ar"
                  dir="rtl"
                  className="field-control"
                  placeholder="e.g. فْعُل"
                  value={toDisplayTemplate(typeof rules.imperfect_stem === "string" ? rules.imperfect_stem : "")}
                  onChange={(e) => setKey("imperfect_stem", toRawTemplate(e.target.value))}
                />
              ) : (
                <div className="space-y-3">
                  {IMPERFECT_MOOD_KEYS.map((mood) => (
                    <MoodSection
                      key={mood}
                      moodKey={mood}
                      value={rules[mood]}
                      persons={PERSONS}
                      forceGrid={noAffix}
                      onChange={(next) => setKey(mood, next)}
                    />
                  ))}
                </div>
              )}
            </div>

            {ruleErrors.length > 0 && (
              <ul className="space-y-1 text-sm text-red-600">
                {ruleErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    />
  );
};

export default RulesEditor;
