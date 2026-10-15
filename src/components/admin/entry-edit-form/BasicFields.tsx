import { Controller, useFormContext, useWatch } from "react-hook-form";
import { getFieldHintId } from "~/components/ui/Field";
import FocusFirstInvalidField from "~/components/ui/FocusFirstInvalidField";
import SelectField from "~/components/ui/SelectField";
import TextField from "~/components/ui/TextField";
import UnsavedChangesGuard from "~/components/ui/UnsavedChangesGuard";
import {
  formatVerbFormChoiceLabel,
  formIVerbFormChoices,
  higherVerbFormChoices,
  quadriliteralVerbFormChoices,
} from "~/lib/validation/verbFormChoice";
import type { PartOfSpeechType } from "~/server/db/schema";
import PatternVariantSelect from "./PatternVariantSelect";
import type { EntryFormInput, EntryFormValues } from "./schema";
import VerbFormStatus from "./VerbFormStatus";

const BasicFields = () => {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<EntryFormInput, unknown, EntryFormValues>();
  const language = useWatch({ control, name: "language" });
  const senses = useWatch({ control, name: "senses" });
  const root = useWatch({ control, name: "root" });
  const verbFormChoice = useWatch({ control, name: "verbFormChoice" });
  const isArabic = language === "ar";
  const hasSenseWith = (pos: PartOfSpeechType) => senses?.some((s) => s.pos === pos) ?? false;
  const hasVerb = hasSenseWith("verb");
  const hasNoun = hasSenseWith("noun");
  const hasAdjective = hasSenseWith("adjective");

  return (
    <>
      <UnsavedChangesGuard />
      <FocusFirstInvalidField />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="language"
          label="Language"
          registration={register("language")}
          error={errors.language?.message}
        >
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </SelectField>

        <TextField
          id="text"
          label="Text"
          lang={language}
          registration={register("text")}
          error={errors.text?.message}
        />

        {isArabic ? (
          <>
            <TextField
              id="root"
              label="Root (Arabic)"
              lang="ar"
              registration={register("root")}
              error={errors.root?.message}
            />

            {hasVerb && (
              <>
                <div>
                  <TextField
                    id="masdar_override"
                    label="Masdar override"
                    lang="ar"
                    hint="Replaces the generated masdar. Leave empty to use the pattern."
                    registration={register("morphologyOverrides.masdar_override")}
                    error={errors.morphologyOverrides?.masdar_override?.message}
                  />
                </div>
                <div>
                  <TextField
                    id="active_participle_override"
                    label="Active participle override"
                    lang="ar"
                    hint="Replaces the generated active participle. Leave empty to use the pattern."
                    registration={register("morphologyOverrides.active_participle_override")}
                    error={errors.morphologyOverrides?.active_participle_override?.message}
                  />
                </div>
                <div>
                  <TextField
                    id="passive_participle_override"
                    label="Passive participle override"
                    lang="ar"
                    hint="Replaces the generated passive participle. Ignored while No passive voice is checked."
                    registration={register("morphologyOverrides.passive_participle_override")}
                    error={errors.morphologyOverrides?.passive_participle_override?.message}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Controller
                    name="verbFormChoice"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        id="verbFormChoice"
                        label="Verb form"
                        registration={{
                          ...field,
                          onChange: (e) => field.onChange(e.target.value || null),
                          value: field.value ?? "",
                        }}
                        error={errors.verbFormChoice?.message}
                      >
                        <option value="" disabled>
                          Select a verb form
                        </option>
                        <optgroup label="Form I">
                          {formIVerbFormChoices.map((choice) => (
                            <option key={choice} value={choice}>
                              {formatVerbFormChoiceLabel(choice)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Forms II – X">
                          {higherVerbFormChoices.map((choice) => (
                            <option key={choice} value={choice}>
                              {formatVerbFormChoiceLabel(choice)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Quadriliteral forms Iq – IVq">
                          {quadriliteralVerbFormChoices.map((choice) => (
                            <option key={choice} value={choice}>
                              {formatVerbFormChoiceLabel(choice)}
                            </option>
                          ))}
                        </optgroup>
                      </SelectField>
                    )}
                  />
                  {root?.trim() && <VerbFormStatus root={root.trim()} verbFormChoice={verbFormChoice ?? null} />}
                </div>
                <PatternVariantSelect />
                <div className="flex flex-col justify-end">
                  <Controller
                    name="morphologyOverrides.no_passive"
                    control={control}
                    render={({ field }) => (
                      <>
                        <label className="flex items-center space-x-2">
                          <input
                            id="no_passive"
                            type="checkbox"
                            checked={field.value ?? false}
                            onChange={(e) => field.onChange(e.target.checked)}
                            onBlur={field.onBlur}
                            aria-describedby={getFieldHintId("no_passive")}
                            className="border-gray-300"
                          />
                          <span>No passive voice</span>
                        </label>
                      </>
                    )}
                  />
                </div>
              </>
            )}

            {hasNoun && (
              <>
                <TextField
                  id="dual_form"
                  label="Dual form"
                  lang="ar"
                  registration={register("morphologyOverrides.dual_form")}
                  error={errors.morphologyOverrides?.dual_form?.message}
                />
                <TextField
                  id="plural_form"
                  label="Plural form"
                  lang="ar"
                  registration={register("morphologyOverrides.plural_form")}
                  error={errors.morphologyOverrides?.plural_form?.message}
                />
              </>
            )}

            {hasAdjective && (
              <div>
                <TextField
                  id="elative_form"
                  label="Elative form"
                  lang="ar"
                  registration={register("morphologyOverrides.elative_form")}
                  error={errors.morphologyOverrides?.elative_form?.message}
                />
              </div>
            )}
          </>
        ) : (
          hasNoun && (
            <TextField
              id="plural_form"
              label="Plural form"
              lang="en"
              registration={register("morphologyOverrides.plural_form")}
              error={errors.morphologyOverrides?.plural_form?.message}
            />
          )
        )}

        <div className="flex flex-col justify-end">
          <Controller
            name="isVerified"
            control={control}
            render={({ field }) => (
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  className="border-gray-300"
                />
                <span>Verified</span>
              </label>
            )}
          />
        </div>
      </div>
    </>
  );
};

export default BasicFields;
