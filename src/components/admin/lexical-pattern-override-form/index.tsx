"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { createOverrideAction, updateOverrideAction } from "~/server/actions/lexical-pattern-override";
import BasicFields from "./BasicFields";
import { type OverrideFormInput, type OverrideFormValues, overrideFormSchema } from "./schema";

type LexicalPatternOverrideFormProps = { morphPatternId: number } & (
  | { mode: "create"; override: OverrideFormInput }
  | { mode: "edit"; override: OverrideFormInput & { id: number } }
);

const LexicalPatternOverrideForm = (props: LexicalPatternOverrideFormProps) => {
  const { morphPatternId, override } = props;
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<OverrideFormInput, unknown, OverrideFormValues>({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: override,
    mode: "onBlur",
  });
  const { isSubmitting } = methods.formState;

  const onSubmit = async (values: OverrideFormValues) => {
    try {
      if (props.mode === "edit") {
        await updateOverrideAction(morphPatternId, { ...values, id: props.override.id });
      } else {
        await createOverrideAction(morphPatternId, values);
      }
      router.push(`/admin/morph-patterns/${morphPatternId}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save override.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <BasicFields />

        {serverError && <p className="text-red-600">{serverError}</p>}

        <div className="flex space-x-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Saving..." : props.mode === "edit" ? "Save Changes" : "Add Override"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </FormProvider>
  );
};

export { LexicalPatternOverrideForm };
