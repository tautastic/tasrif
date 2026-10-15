"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import FormCancelButton from "~/components/ui/FormCancelButton";
import FormError from "~/components/ui/FormError";
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
    setServerError(null);
    try {
      const result =
        props.mode === "edit"
          ? await updateOverrideAction(morphPatternId, { ...values, id: props.override.id })
          : await createOverrideAction(morphPatternId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/admin/morph-patterns/${morphPatternId}`);
    } catch {
      setServerError("Failed to save override. Please try again.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <BasicFields />

        <FormError message={serverError} />

        <div className="flex space-x-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Saving..." : props.mode === "edit" ? "Save Changes" : "Add Override"}
          </button>
          <FormCancelButton fallbackHref={`/admin/morph-patterns/${morphPatternId}`} />
        </div>
      </form>
    </FormProvider>
  );
};

export { LexicalPatternOverrideForm };
