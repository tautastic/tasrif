"use client";

import { useFormContext, useWatch } from "react-hook-form";
import PatternPreviewPanel from "~/components/admin/PatternPreviewPanel";
import type { MorphPatternRules } from "~/lib/validation/morphPatternRules";
import type { MorphPatternFormInput, MorphPatternFormValues } from "./schema";

const TemplatePreview = () => {
  const { control } = useFormContext<MorphPatternFormInput, unknown, MorphPatternFormValues>();
  const rules = useWatch({ control, name: "rules" });
  const formNumber = useWatch({ control, name: "formNumber" });
  const noAffix = useWatch({ control, name: "noAffix" });

  return (
    <PatternPreviewPanel
      rules={(rules ?? {}) as MorphPatternRules}
      formNumber={Number(formNumber) || 1}
      noAffix={noAffix ?? false}
    />
  );
};

export default TemplatePreview;
