"use client";

import type { InputHTMLAttributes } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { toDisplayTemplate, toRawTemplate } from "./radicalPlaceholders";
import type { MorphPatternFormInput, MorphPatternFormValues } from "./schema";

export const TEMPLATE_HELP_ID = "rules-template-help";

interface TemplateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (raw: string) => void;
}

const TemplateInput = ({ value, onValueChange, ...rest }: TemplateInputProps) => {
  const { control } = useFormContext<MorphPatternFormInput, unknown, MorphPatternFormValues>();
  const radicalCount = Number(useWatch({ control, name: "radicalCount" })) === 4 ? 4 : 3;

  return (
    <input
      {...rest}
      type="text"
      lang="ar"
      dir="rtl"
      className="field-control"
      aria-describedby={TEMPLATE_HELP_ID}
      value={toDisplayTemplate(value, radicalCount)}
      onChange={(event) => onValueChange(toRawTemplate(event.target.value, radicalCount))}
    />
  );
};

export default TemplateInput;
