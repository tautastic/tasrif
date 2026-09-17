import { Controller, useFormContext, useWatch } from "react-hook-form";
import SelectField from "~/components/ui/SelectField";
import TextField from "~/components/ui/TextField";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { type RadicalKind, radicalKindEnum, shortVowelEnum } from "~/server/db/schema";
import type { MorphPatternFormInput, MorphPatternFormValues } from "./schema";

const RADICAL_KIND_LABELS: Record<RadicalKind, string> = {
  sound: "Sound",
  waw: "Weak — و",
  ya: "Weak — ي",
  hamza: "Hamza",
};

const FORM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const BasicFields = () => {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<MorphPatternFormInput, unknown, MorphPatternFormValues>();
  const formNumber = useWatch({ control, name: "formNumber" });
  const isFormOne = Number(formNumber) === 1;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Controller
        name="formNumber"
        control={control}
        render={({ field }) => (
          <SelectField
            id="formNumber"
            label="Form"
            error={errors.formNumber?.message}
            registration={{
              ...field,
              value: field.value ?? "",
              onChange: (e) => {
                const next = Number(e.target.value);
                field.onChange(next);
                if (next !== 1) {
                  setValue("perfectVowel", null);
                  setValue("imperfectVowel", null);
                }
              },
            }}
          >
            {FORM_NUMBERS.map((n) => (
              <option key={n} value={n}>
                Form {formatMorphPatternFormNumber(n)}
              </option>
            ))}
          </SelectField>
        )}
      />

      <TextField
        id="vocalicTemplate"
        label="Vocalic template"
        lang="ar"
        dir="rtl"
        registration={register("vocalicTemplate")}
        error={errors.vocalicTemplate?.message}
      />

      <div className="sm:col-span-2">
        <TextField
          id="description"
          label="Description"
          registration={register("description")}
          error={errors.description?.message}
        />
      </div>

      {(["perfectVowel", "imperfectVowel"] as const).map((name) => (
        <Controller
          key={name}
          name={name}
          control={control}
          render={({ field }) => (
            <SelectField
              id={name}
              label={name === "perfectVowel" ? "Perfect vowel" : "Imperfect vowel"}
              disabled={!isFormOne}
              registration={{
                ...field,
                onChange: (e) => field.onChange(e.target.value === "" ? null : e.target.value),
                value: field.value ?? "",
              }}
              error={errors[name]?.message}
            >
              <option value="">—</option>
              {shortVowelEnum.enumValues.map((vowel) => (
                <option key={vowel} value={vowel}>
                  {vowel}
                </option>
              ))}
            </SelectField>
          )}
        />
      ))}

      {(["radical1Kind", "radical2Kind", "radical3Kind"] as const).map((name, index) => (
        <SelectField key={name} id={name} label={`Radical ${index + 1}`} registration={register(name)}>
          {radicalKindEnum.enumValues.map((kind) => (
            <option key={kind} value={kind}>
              {RADICAL_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>
      ))}

      <div className="flex flex-col justify-end gap-2 sm:col-span-2 sm:flex-row sm:gap-6">
        {(
          [
            ["isGeminate", "Geminate (doubled root)"],
            ["noAffix", "No affix (spell every person out)"],
            ["isLexical", "Lexical (only reachable via an override)"],
          ] as const
        ).map(([name, label]) => (
          <Controller
            key={name}
            name={name}
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
                <span>{label}</span>
              </label>
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default BasicFields;
