import type { ChangeEvent } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import AsyncSenseSelect from "~/components/admin/entry-edit-form/AsyncSenseSelect";
import SelectField from "~/components/ui/SelectField";
import TextAreaField from "~/components/ui/TextAreaField";
import TextField from "~/components/ui/TextField";
import { formatPartOfSpeechType, formatSenseRelationType } from "~/lib/formatting";
import { type LanguageType, posTypes, senseRelationTypeEnum } from "~/server/db/schema";
import type { EntryFormInput, EntryFormValues } from "./schema";

interface SenseEditorProps {
  senseIndex: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  language: LanguageType;
}

const SenseEditor = ({
  senseIndex,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  language,
}: SenseEditorProps) => {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<EntryFormInput, unknown, EntryFormValues>();

  const translationsFieldArray = useFieldArray({
    control,
    name: `senses.${senseIndex}.translations`,
  });
  const relationsFieldArray = useFieldArray({
    control,
    name: `senses.${senseIndex}.relatedSenses`,
  });

  return (
    <fieldset className="border border-gray-300 rounded p-4 mb-4">
      <legend className="px-2 flex items-center gap-1">
        <span>Sense {senseIndex + 1}</span>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-gray-600 hover:text-gray-900 disabled:opacity-30 text-sm"
          aria-label="Move sense up"
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-gray-600 hover:text-gray-900 disabled:opacity-30 text-sm"
          aria-label="Move sense down"
          title="Move down"
        >
          ↓
        </button>
        <button type="button" onClick={onRemove} className="ml-1 text-red-600 hover:text-red-800 text-sm">
          Remove
        </button>
      </legend>

      <div className="grid grid-cols-1 gap-4">
        <SelectField
          id={`sense-${senseIndex}-pos`}
          label="Part of Speech"
          registration={register(`senses.${senseIndex}.pos`)}
          error={errors.senses?.[senseIndex]?.pos?.message}
        >
          <option className="hidden"></option>
          {posTypes.map((pos) => (
            <option key={pos} value={pos}>
              {formatPartOfSpeechType(pos)}
            </option>
          ))}
        </SelectField>

        <Controller
          name={`senses.${senseIndex}.definitions`}
          control={control}
          render={({ field }) => (
            <TextAreaField
              id={`sense-${senseIndex}-defs`}
              label="Definitions (one per line)"
              registration={{
                ...field,
                onChange: (e: ChangeEvent<HTMLTextAreaElement>) => field.onChange(e.target.value.split("\n")),
                onBlur: field.onBlur,
                value: field.value?.join("\n") ?? "",
              }}
              error={errors.senses?.[senseIndex]?.definitions?.message}
            />
          )}
        />

        <Controller
          name={`senses.${senseIndex}.examples`}
          control={control}
          render={({ field }) => (
            <TextAreaField
              id={`sense-${senseIndex}-examples`}
              label="Examples (one per line)"
              lang={language}
              registration={{
                ...field,
                onChange: (e: ChangeEvent<HTMLTextAreaElement>) => field.onChange(e.target.value.split("\n")),
                onBlur: field.onBlur,
                value: field.value?.join("\n") ?? "",
              }}
              error={undefined}
            />
          )}
        />

        <div>
          <h3 className="text-md font-medium mb-1">Translations</h3>
          <button
            type="button"
            onClick={() => translationsFieldArray.append({ targetSenseId: 0, domain: "", note: "" })}
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            + Add Translation
          </button>

          {translationsFieldArray.fields.map((translation, translationIndex) => (
            <fieldset key={translation.id} className="border border-gray-300 rounded p-3 mb-3">
              <legend className="px-2">
                Translation {translationIndex + 1}
                <button
                  type="button"
                  onClick={() => translationsFieldArray.remove(translationIndex)}
                  className="ml-2 text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`translation-target-${senseIndex}-${translationIndex}`}
                    className="block text-sm font-medium mb-1"
                  >
                    Target Sense
                  </label>
                  <Controller
                    name={`senses.${senseIndex}.translations.${translationIndex}.targetSenseId`}
                    control={control}
                    render={({ field }) => (
                      <AsyncSenseSelect
                        id={`translation-target-${senseIndex}-${translationIndex}`}
                        language={language === "en" ? "ar" : "en"}
                        value={Number(field.value ?? 0)}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Search target sense"
                      />
                    )}
                  />
                </div>

                <TextField
                  id={`translation-domain-${senseIndex}-${translationIndex}`}
                  label="Domain (optional)"
                  registration={register(`senses.${senseIndex}.translations.${translationIndex}.domain` as const)}
                  error={undefined}
                />

                <TextField
                  id={`translation-note-${senseIndex}-${translationIndex}`}
                  label="Note (optional)"
                  registration={register(`senses.${senseIndex}.translations.${translationIndex}.note` as const)}
                  error={undefined}
                />
              </div>
            </fieldset>
          ))}
        </div>

        <div>
          <h3 className="text-md font-medium mb-1">Relations</h3>
          <button
            type="button"
            onClick={() =>
              relationsFieldArray.append({
                targetSenseId: 0,
                relationType: "synonym" as const,
                contextNote: "",
                strength: 5,
              })
            }
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            + Add Relation
          </button>

          {relationsFieldArray.fields.map((relation, relationIndex) => (
            <fieldset key={relation.id} className="border border-gray-300 rounded p-3 mb-3">
              <legend className="px-2">
                Relation {relationIndex + 1}
                <button
                  type="button"
                  onClick={() => relationsFieldArray.remove(relationIndex)}
                  className="ml-2 text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`relation-target-${senseIndex}-${relationIndex}`}
                    className="block text-sm font-medium mb-1"
                  >
                    Target Sense
                  </label>
                  <Controller
                    name={`senses.${senseIndex}.relatedSenses.${relationIndex}.targetSenseId`}
                    control={control}
                    render={({ field }) => (
                      <AsyncSenseSelect
                        id={`relation-target-${senseIndex}-${relationIndex}`}
                        language={language}
                        value={Number(field.value ?? 0)}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Search target sense"
                      />
                    )}
                  />
                </div>

                <SelectField
                  id={`relation-type-${senseIndex}-${relationIndex}`}
                  label="Relation Type"
                  registration={register(`senses.${senseIndex}.relatedSenses.${relationIndex}.relationType` as const)}
                  error={undefined}
                >
                  {senseRelationTypeEnum.enumValues.map((type) => (
                    <option key={type} value={type}>
                      {formatSenseRelationType(type)}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  id={`relation-context-${senseIndex}-${relationIndex}`}
                  label="Context Note (optional)"
                  registration={register(`senses.${senseIndex}.relatedSenses.${relationIndex}.contextNote` as const)}
                  error={undefined}
                />

                <TextField
                  id={`relation-strength-${senseIndex}-${relationIndex}`}
                  label="Strength (1-10)"
                  type="number"
                  min={1}
                  max={10}
                  registration={register(`senses.${senseIndex}.relatedSenses.${relationIndex}.strength` as const, {
                    valueAsNumber: true,
                  })}
                  error={undefined}
                />
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </fieldset>
  );
};

const SensesFields = () => {
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<EntryFormInput, unknown, EntryFormValues>();
  const sensesFieldArray = useFieldArray({
    control,
    name: "senses",
  });
  const language = useWatch({ control, name: "language" });

  const getCurrentSenses = (): EntryFormInput["senses"] =>
    (getValues("senses") ?? []).filter((sense): sense is EntryFormInput["senses"][number] => sense !== undefined);

  const replaceWithRenumbered = (senses: EntryFormInput["senses"]) => {
    sensesFieldArray.replace(senses.map((sense, index) => ({ ...sense, senseNumber: index + 1 })));
  };

  const addSense = () => {
    const currentSenses = getCurrentSenses();
    const maxSenseNumber = currentSenses.reduce((max, sense) => Math.max(max, sense.senseNumber ?? 0), 0);

    sensesFieldArray.append({
      pos: null,
      senseNumber: maxSenseNumber + 1,
      definitions: [],
      examples: [],
      translations: [],
      relatedSenses: [],
    });
  };

  const removeSense = (index: number) => {
    replaceWithRenumbered(getCurrentSenses().filter((_, i) => i !== index));
  };

  const moveSense = (index: number, direction: -1 | 1) => {
    const currentSenses = getCurrentSenses();
    const targetIndex = index + direction;
    const moved = currentSenses[index];
    const target = currentSenses[targetIndex];
    if (!moved || !target) {
      return;
    }
    const reordered = [...currentSenses];
    reordered[index] = target;
    reordered[targetIndex] = moved;
    replaceWithRenumbered(reordered);
  };

  return (
    <div>
      <div className="mb-2 flex flex-row gap-x-3 items-center">
        <h2 className="text-xl font-semibold">Senses</h2>
        <button
          type="button"
          onClick={addSense}
          className="bg-green-600 text-sm text-white rounded px-3 py-1 hover:bg-green-700"
        >
          +
        </button>
      </div>

      {sensesFieldArray.fields.map((sense, index) => (
        <SenseEditor
          key={sense.id}
          senseIndex={index}
          onRemove={() => removeSense(index)}
          onMoveUp={() => moveSense(index, -1)}
          onMoveDown={() => moveSense(index, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < sensesFieldArray.fields.length - 1}
          language={language}
        />
      ))}

      {errors.senses?.message && <p className="text-red-600 text-sm mt-1">{errors.senses.message}</p>}
    </div>
  );
};

export default SensesFields;
