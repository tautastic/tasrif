import { Controller, useFormContext, useWatch } from "react-hook-form";
import SelectField from "~/components/ui/SelectField";
import TextAreaField from "~/components/ui/TextAreaField";
import TextField from "~/components/ui/TextField";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { shortVowelEnum } from "~/server/db/schema";
import type { OverrideFormInput, OverrideFormValues } from "./schema";

const FORM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const BasicFields = () => {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OverrideFormInput, unknown, OverrideFormValues>();
  const formNumber = useWatch({ control, name: "formNumber" });
  const isFormOne = Number(formNumber) === 1;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        id="root"
        label="Root (Arabic)"
        lang="ar"
        dir="rtl"
        registration={register("root")}
        error={errors.root?.message}
      />

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

      <div className="sm:col-span-2">
        <TextAreaField id="note" label="Note" registration={register("note")} error={errors.note?.message} />
      </div>
    </div>
  );
};

export default BasicFields;
