"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type { MorphPatternFormInput, MorphPatternFormValues } from "./schema";
import { TEMPLATE_HELP_ID } from "./TemplateInput";

const TRILITERAL_LEGEND_ROWS = [
  { typed: ["ف"], meaning: "the first letter of the root", stored: ["{1}"] },
  { typed: ["ع"], meaning: "the second letter of the root", stored: ["{2}"] },
  { typed: ["ل"], meaning: "the third letter of the root", stored: ["{3}"] },
  { typed: ["\\ف", "\\ع", "\\ل"], meaning: "the letter itself, not a placeholder", stored: ["ف", "ع", "ل"] },
] as const;

const QUADRILITERAL_LEGEND_ROWS = [
  { typed: ["ف"], meaning: "the first letter of the root", stored: ["{1}"] },
  { typed: ["ع"], meaning: "the second letter of the root", stored: ["{2}"] },
  { typed: ["ل"], meaning: "the third letter of the root", stored: ["{3}"] },
  { typed: ["ق"], meaning: "the fourth letter of the root", stored: ["{4}"] },
  {
    typed: ["\\ف", "\\ع", "\\ل", "\\ق"],
    meaning: "the letter itself, not a placeholder",
    stored: ["ف", "ع", "ل", "ق"],
  },
] as const;

const Samples = ({ values }: { values: readonly string[] }) => (
  <span className="inline-flex gap-2">
    {values.map((value) => (
      <bdi key={value} dir="ltr" lang="ar" className="bg-white px-1.5 py-0.5 font-medium [direction:ltr]">
        {value}
      </bdi>
    ))}
  </span>
);

const TemplateLegend = () => {
  const { control } = useFormContext<MorphPatternFormInput, unknown, MorphPatternFormValues>();
  const isQuadriliteral = Number(useWatch({ control, name: "radicalCount" })) === 4;
  const rows = isQuadriliteral ? QUADRILITERAL_LEGEND_ROWS : TRILITERAL_LEGEND_ROWS;

  return (
    <div id={TEMPLATE_HELP_ID} className="space-y-2 border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
      <p>
        Type <Samples values={isQuadriliteral ? ["ف", "ع", "ل", "ق"] : ["ف", "ع", "ل"]} /> where the root letters go. To
        use one of them as an ordinary letter of the pattern, put a backslash in front of it.
      </p>
      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1">
        {rows.map((row) => (
          <div key={row.meaning} className="contents">
            <dt>
              <Samples values={row.typed} />
            </dt>
            <dd>{row.meaning}</dd>
            <dd className="flex items-center gap-2 text-xs text-gray-600">
              stored as <Samples values={row.stored} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default TemplateLegend;
