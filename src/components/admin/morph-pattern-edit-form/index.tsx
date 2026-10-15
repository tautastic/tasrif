"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import FormCancelButton from "~/components/ui/FormCancelButton";
import FormError from "~/components/ui/FormError";
import { createMorphPatternAction, updateMorphPatternAction } from "~/server/actions/morph-pattern";
import BasicFields from "./BasicFields";
import RulesEditor from "./RulesEditor";
import { type MorphPatternFormInput, type MorphPatternFormValues, morphPatternFormSchema } from "./schema";
import TemplatePreview from "./TemplatePreview";

type MorphPatternEditFormProps =
  | { mode: "create"; pattern: MorphPatternFormInput }
  | { mode: "edit"; pattern: MorphPatternFormInput & { id: number } };

const MorphPatternEditForm = (props: MorphPatternEditFormProps) => {
  const { pattern } = props;
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<MorphPatternFormInput, unknown, MorphPatternFormValues>({
    resolver: zodResolver(morphPatternFormSchema),
    defaultValues: pattern,
    mode: "onBlur",
  });
  const { isSubmitting } = methods.formState;

  const onSubmit = async (values: MorphPatternFormValues) => {
    setServerError(null);
    try {
      const result =
        props.mode === "edit"
          ? await updateMorphPatternAction({ ...values, id: props.pattern.id })
          : await createMorphPatternAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/admin/morph-patterns/${result.data.id}`);
    } catch {
      setServerError("Failed to save pattern. Please try again.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <BasicFields />
        <RulesEditor />
        <TemplatePreview />

        <FormError message={serverError} />

        <div className="flex space-x-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Saving..." : props.mode === "edit" ? "Save Changes" : "Create Pattern"}
          </button>
          <FormCancelButton
            fallbackHref={props.mode === "edit" ? `/admin/morph-patterns/${props.pattern.id}` : "/admin/morph-patterns"}
          />
        </div>
      </form>
    </FormProvider>
  );
};

export { MorphPatternEditForm };
