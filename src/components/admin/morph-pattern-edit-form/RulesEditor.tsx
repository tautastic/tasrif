"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Field } from "~/components/ui/Field";
import {
  IMPERATIVE_PERSONS,
  IMPERFECT_MOOD_KEYS,
  type Mood,
  type MorphPatternRules,
  PASSIVE_IMPERFECT_MOOD_KEYS,
  PASSIVE_PERFECT_KEY,
  PASSIVE_STEM_KEY,
  type PassiveKey,
  PERSONS,
  type Person,
  STRING_KEYS,
} from "~/lib/validation/morphPatternRules";
import PersonFormsGrid from "./PersonFormsGrid";
import type { MorphPatternFormInput, MorphPatternFormValues } from "./schema";
import TemplateInput from "./TemplateInput";
import TemplateLegend from "./TemplateLegend";

type RulesRecord = Record<string, string | Partial<Record<Person, string>> | undefined>;
type MoodValue = string | Partial<Record<Person, string>> | undefined;

const STRING_KEY_LABELS: Record<(typeof STRING_KEYS)[number], string> = {
  masdar: "Masdar (verbal noun)",
  active_participle: "Active participle",
  passive_participle: "Passive participle",
};

const MOOD_LABELS: Record<Mood | PassiveKey, string> = {
  perfect: "Perfect",
  imperative: "Imperative",
  imperfect_indicative: "Imperfect — indicative",
  imperfect_subjunctive: "Imperfect — subjunctive",
  imperfect_jussive: "Imperfect — jussive",
  passive_perfect: "Perfect passive",
  passive_imperfect_stem: "Imperfect passive stem",
  passive_imperfect_indicative: "Imperfect passive — indicative",
  passive_imperfect_subjunctive: "Imperfect passive — subjunctive",
  passive_imperfect_jussive: "Imperfect passive — jussive",
};

const MoodSection = ({
  moodKey,
  value,
  persons,
  forceGrid,
  onChange,
}: {
  moodKey: Mood | PassiveKey;
  value: MoodValue;
  persons: readonly Person[];
  forceGrid: boolean;
  onChange: (next: MoodValue) => void;
}) => {
  const isGrid = forceGrid || typeof value === "object";

  return (
    <fieldset className="border border-gray-200 p-3">
      <legend className="sr-only">{MOOD_LABELS[moodKey]}</legend>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium" aria-hidden="true">
          {MOOD_LABELS[moodKey]}
        </span>
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
        <TemplateInput
          aria-label={`${MOOD_LABELS[moodKey]} template`}
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        />
      )}
    </fieldset>
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
        const usesPassiveStem = !noAffix && rules.passive_imperfect_stem !== undefined;

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

        const switchToPassiveStem = () => {
          const next: RulesRecord = { ...(rules as RulesRecord), [PASSIVE_STEM_KEY]: "" };
          for (const key of PASSIVE_IMPERFECT_MOOD_KEYS) {
            delete next[key];
          }
          field.onChange(next as MorphPatternRules);
        };

        const switchToExplicitPassiveMoods = () => {
          const next: RulesRecord = { ...(rules as RulesRecord) };
          delete next[PASSIVE_STEM_KEY];
          field.onChange(next as MorphPatternRules);
        };

        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Rules</h2>
            <TemplateLegend />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {STRING_KEYS.map((key) => (
                <Field key={key} id={`rules-${key}`} label={STRING_KEY_LABELS[key]}>
                  <TemplateInput
                    id={`rules-${key}`}
                    value={rules[key] ?? ""}
                    onValueChange={(raw) => setKey(key, raw)}
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

            <fieldset className="border border-gray-200 p-3">
              <legend className="sr-only">Imperfect</legend>
              <div className="mb-2 flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium" aria-hidden="true">
                  Imperfect
                </span>
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
                <TemplateInput
                  aria-label="Imperfect stem template"
                  placeholder="e.g. فْعُل"
                  value={typeof rules.imperfect_stem === "string" ? rules.imperfect_stem : ""}
                  onValueChange={(raw) => setKey("imperfect_stem", raw)}
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
            </fieldset>

            <fieldset className="border border-gray-200 p-3">
              <legend className="sr-only">Passive voice</legend>
              <p className="mb-2 text-sm font-medium" aria-hidden="true">
                Passive voice
              </p>
              <p className="mb-3 text-xs text-gray-600">
                Optional. There is no passive imperative. An entry drops the passive with its &quot;No passive
                voice&quot; box.
              </p>
              <div className="space-y-3">
                <MoodSection
                  moodKey={PASSIVE_PERFECT_KEY}
                  value={rules.passive_perfect}
                  persons={PERSONS}
                  forceGrid={noAffix}
                  onChange={(next) => setKey(PASSIVE_PERFECT_KEY, next)}
                />
                <fieldset className="border border-gray-200 p-3">
                  <legend className="sr-only">Imperfect passive</legend>
                  <div className="mb-2 flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium" aria-hidden="true">
                      Imperfect passive
                    </span>
                    {!noAffix && (
                      <>
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="radio"
                            name="passive-imperfect-mode"
                            checked={usesPassiveStem}
                            onChange={switchToPassiveStem}
                          />
                          Regular affixation from a stem
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="radio"
                            name="passive-imperfect-mode"
                            checked={!usesPassiveStem}
                            onChange={switchToExplicitPassiveMoods}
                          />
                          Spell out each mood
                        </label>
                      </>
                    )}
                  </div>
                  {usesPassiveStem ? (
                    <TemplateInput
                      aria-label="Imperfect passive stem template"
                      placeholder="e.g. فْعَل"
                      value={typeof rules.passive_imperfect_stem === "string" ? rules.passive_imperfect_stem : ""}
                      onValueChange={(raw) => setKey(PASSIVE_STEM_KEY, raw)}
                    />
                  ) : (
                    <div className="space-y-3">
                      {PASSIVE_IMPERFECT_MOOD_KEYS.map((key) => (
                        <MoodSection
                          key={key}
                          moodKey={key}
                          value={rules[key]}
                          persons={PERSONS}
                          forceGrid={noAffix}
                          onChange={(next) => setKey(key, next)}
                        />
                      ))}
                    </div>
                  )}
                </fieldset>
              </div>
            </fieldset>

            {ruleErrors.length > 0 && (
              <ul role="alert" className="space-y-1 text-sm text-red-700">
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
