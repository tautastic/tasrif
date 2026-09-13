import { Controller, useFormContext, useWatch } from "react-hook-form";
import SelectField from "~/components/ui/SelectField";
import TextField from "~/components/ui/TextField";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import type { MorphPatternSelect, PartOfSpeechType } from "~/server/db/schema";
import type { EntryFormInput, EntryFormValues } from "./schema";

const formatMorphPatternFullTitle = (formNumber: number, description: string): string => {
  const title = `Form ${formatMorphPatternFormNumber(formNumber)}`;
  return description === "" ? title : `${title}, ${description}`;
};

interface BasicFieldsProps {
  morphPatternOptions: MorphPatternSelect[];
}

const BasicFields = ({ morphPatternOptions }: BasicFieldsProps) => {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<EntryFormInput, unknown, EntryFormValues>();
  const language = useWatch({ control, name: "language" });
  const senses = useWatch({ control, name: "senses" });
  const isArabic = language === "ar";
  const hasSenseWith = (pos: PartOfSpeechType) => senses?.some((s) => s.pos === pos) ?? false;
  const hasVerb = hasSenseWith("verb");
  const hasNoun = hasSenseWith("noun");
  const hasAdjective = hasSenseWith("adjective");

  return (
    <div className="grid grid-cols-2 gap-4">
      <SelectField id="language" label="Language" registration={register("language")} error={errors.language?.message}>
        <option value="en">English</option>
        <option value="ar">Arabic</option>
      </SelectField>

      <TextField id="text" label="Text" lang={language} registration={register("text")} error={errors.text?.message} />

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
                  registration={register("morphologyOverrides.masdar_override")}
                  error={errors.morphologyOverrides?.masdar_override?.message}
                />
              </div>
              <div className="col-span-2">
                <Controller
                  name="morphPatternId"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      id="morphPatternId"
                      label="Pattern"
                      registration={{
                        ...field,
                        onChange: (e) => field.onChange(e.target.value ? Number(e.target.value) : null),
                        value: field.value ?? "",
                      }}
                      error={errors.morphPatternId?.message}
                    >
                      <option className="hidden" value=""></option>
                      {morphPatternOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatMorphPatternFullTitle(p.formNumber, p.description)}
                        </option>
                      ))}
                    </SelectField>
                  )}
                />
              </div>
              <div className="flex flex-col justify-end">
                <Controller
                  name="morphologyOverrides.no_passive"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        onBlur={field.onBlur}
                        className="rounded border-gray-300"
                      />
                      <span>No Passive</span>
                    </label>
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
    </div>
  );
};

export default BasicFields;
