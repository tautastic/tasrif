"use client";

import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import SelectField from "~/components/ui/SelectField";
import { usePatternVariants } from "~/hooks/usePatternVariants";
import { formatPatternVariantLabel } from "~/lib/api/pattern-variants";
import type { EntryFormInput, EntryFormValues } from "./schema";

const FIELD_NAME = "chosenMorphPatternId";

const PatternVariantSelect = () => {
  const { control, setValue } = useFormContext<EntryFormInput, unknown, EntryFormValues>();
  const root = useWatch({ control, name: "root" });
  const verbFormChoice = useWatch({ control, name: "verbFormChoice" });
  const entryId = useWatch({ control, name: "id" });
  const chosen = useWatch({ control, name: FIELD_NAME });
  const trimmedRoot = (root ?? "").trim();
  const choice = verbFormChoice ?? null;

  const previous = useRef({ root: trimmedRoot, choice });
  useEffect(() => {
    if (previous.current.root !== trimmedRoot || previous.current.choice !== choice) {
      previous.current = { root: trimmedRoot, choice };
      setValue(FIELD_NAME, null, { shouldDirty: false });
    }
  }, [trimmedRoot, choice, setValue]);

  const response = usePatternVariants(trimmedRoot, choice, entryId ?? null);
  if (!response || response.variants.length < 2) {
    return null;
  }

  const defaultOption = response.variants.find((option) => option.isDefault) ?? response.variants[0];
  const selectedId = chosen ?? response.current ?? defaultOption?.id;
  const selected = response.variants.find((option) => option.id === selectedId);

  return (
    <div className="sm:col-span-2">
      <SelectField
        id="chosenMorphPatternId"
        label="Verb variant"
        registration={{
          name: FIELD_NAME,
          ref: () => undefined,
          onBlur: () => undefined,
          onChange: (event) => setValue(FIELD_NAME, Number(event.target.value), { shouldDirty: true }),
          value: selectedId ?? "",
        }}
      >
        {response.variants.map((option) => (
          <option key={option.id} value={option.id}>
            {formatPatternVariantLabel(option)}
          </option>
        ))}
      </SelectField>
      <p className="mt-1 text-xs text-gray-600">
        This root and form belong to more than one verb with a different inflection. Choose the verb this entry
        describes.
        {selected?.note ? ` ${selected.note}` : ""}
      </p>
    </div>
  );
};

export default PatternVariantSelect;
