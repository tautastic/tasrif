import { useRef } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import FocusFirstInvalidField from "~/components/ui/FocusFirstInvalidField";
import SelectField from "~/components/ui/SelectField";
import TextField from "~/components/ui/TextField";
import UnsavedChangesGuard from "~/components/ui/UnsavedChangesGuard";
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
const QUADRILITERAL_FORM_NUMBERS = [1, 2, 3, 4] as const;
const RADICAL_KIND_NAMES = ["radical1Kind", "radical2Kind", "radical3Kind"] as const;
const FOURTH_RADICAL_KINDS = ["sound", "waw", "ya"] as const satisfies readonly RadicalKind[];

type RadicalCount = 3 | 4;
type PatternShape = Pick<
  MorphPatternFormInput,
  | "formNumber"
  | "radical1Kind"
  | "radical2Kind"
  | "radical3Kind"
  | "radical4Kind"
  | "isGeminate"
  | "perfectVowel"
  | "imperfectVowel"
>;

const BasicFields = () => {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<MorphPatternFormInput, unknown, MorphPatternFormValues>();
  const rememberedShapes = useRef<Partial<Record<RadicalCount, PatternShape>>>({});
  const formNumber = useWatch({ control, name: "formNumber" });
  const radicalCount = Number(useWatch({ control, name: "radicalCount" })) === 4 ? 4 : 3;
  const isFormOne = Number(formNumber) === 1;
  const formNumbers = radicalCount === 4 ? QUADRILITERAL_FORM_NUMBERS : FORM_NUMBERS;

  const readShape = (): PatternShape => {
    const values = getValues();
    return {
      formNumber: values.formNumber,
      radical1Kind: values.radical1Kind,
      radical2Kind: values.radical2Kind,
      radical3Kind: values.radical3Kind,
      radical4Kind: values.radical4Kind,
      isGeminate: values.isGeminate,
      perfectVowel: values.perfectVowel,
      imperfectVowel: values.imperfectVowel,
    };
  };

  const writeShape = (shape: PatternShape) => {
    setValue("formNumber", shape.formNumber);
    setValue("radical1Kind", shape.radical1Kind);
    setValue("radical2Kind", shape.radical2Kind);
    setValue("radical3Kind", shape.radical3Kind);
    setValue("radical4Kind", shape.radical4Kind);
    setValue("isGeminate", shape.isGeminate);
    setValue("perfectVowel", shape.perfectVowel);
    setValue("imperfectVowel", shape.imperfectVowel);
  };

  return (
    <>
      <UnsavedChangesGuard />
      <FocusFirstInvalidField />
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
              {formNumbers.map((n) => (
                <option key={n} value={n}>
                  Form {formatMorphPatternFormNumber(n, radicalCount)}
                </option>
              ))}
            </SelectField>
          )}
        />

        <Controller
          name="radicalCount"
          control={control}
          render={({ field }) => (
            <SelectField
              id="radicalCount"
              label="Number of radicals"
              error={errors.radicalCount?.message}
              registration={{
                ...field,
                value: field.value ?? 3,
                onChange: (e) => {
                  const next: RadicalCount = Number(e.target.value) === 4 ? 4 : 3;
                  rememberedShapes.current[radicalCount] = readShape();
                  field.onChange(next);
                  const remembered = rememberedShapes.current[next];
                  if (remembered) {
                    writeShape(remembered);
                    return;
                  }
                  setValue("radical4Kind", "sound");
                  if (next === 4) {
                    for (const name of RADICAL_KIND_NAMES) {
                      setValue(name, "sound");
                    }
                    setValue("isGeminate", false);
                    if (Number(formNumber) > QUADRILITERAL_FORM_NUMBERS.length) {
                      setValue("formNumber", 1);
                      setValue("perfectVowel", "a");
                      setValue("imperfectVowel", "i");
                    }
                  }
                },
              }}
            >
              <option value={3}>Three (triliteral)</option>
              <option value={4}>Four (quadriliteral)</option>
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

        {RADICAL_KIND_NAMES.map((name, index) => (
          <SelectField
            key={name}
            id={name}
            label={`Radical ${index + 1}`}
            disabled={radicalCount === 4}
            error={errors[name]?.message}
            registration={register(name)}
          >
            {radicalKindEnum.enumValues.map((kind) => (
              <option key={kind} value={kind}>
                {RADICAL_KIND_LABELS[kind]}
              </option>
            ))}
          </SelectField>
        ))}

        <SelectField
          id="radical4Kind"
          label="Radical 4"
          disabled={radicalCount === 3}
          error={errors.radical4Kind?.message}
          registration={register("radical4Kind")}
        >
          {FOURTH_RADICAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {RADICAL_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>

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
    </>
  );
};

export default BasicFields;
