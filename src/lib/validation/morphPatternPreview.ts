import { z } from "zod";
import { morphPatternRulesSchema, rulesRadicalCount } from "./morphPatternRules";
import { countRadicals, rootLengthMessage, verbRootSchema } from "./root";

export const morphPatternPreviewInputSchema = z
  .object({
    root: verbRootSchema,
    rules: morphPatternRulesSchema,
    formNumber: z.int({ error: "Form number is required" }).min(1).max(10, { error: "Forms I through X only" }),
    noAffix: z.boolean(),
  })
  .superRefine((input, ctx) => {
    const radicals = rulesRadicalCount(input.rules);
    if (countRadicals(input.root) !== radicals) {
      ctx.addIssue({ code: "custom", message: rootLengthMessage(radicals), path: ["root"] });
    }
  });
