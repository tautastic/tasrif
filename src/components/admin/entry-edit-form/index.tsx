"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import BasicFields from "~/components/admin/entry-edit-form/BasicFields";
import SensesFields from "~/components/admin/entry-edit-form/SensesFields";
import { type EntryFormInput, type EntryFormValues, entryFormSchema } from "~/components/admin/entry-edit-form/schema";
import FormCancelButton from "~/components/ui/FormCancelButton";
import FormError from "~/components/ui/FormError";
import { entryPath } from "~/lib/formatting";
import { createLexicalEntryAction, updateLexicalEntryAction } from "~/server/actions/lexical-entry";

type EntryEditFormProps =
  | { mode: "create"; entry: EntryFormInput }
  | { mode: "edit"; entry: EntryFormInput & { id: number } };

const EntryEditForm = (props: EntryEditFormProps) => {
  const { entry } = props;
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const initialSenses = [...entry.senses]
    .sort((a, b) => (a.senseNumber ?? 0) - (b.senseNumber ?? 0))
    .map((sense, index) => ({ ...sense, senseNumber: index + 1 }));

  const methods = useForm<EntryFormInput, unknown, EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      ...entry,
      senses: initialSenses,
      morphologyOverrides: entry.morphologyOverrides ?? { no_passive: false },
    },
    mode: "onBlur",
  });
  const { isSubmitting } = methods.formState;

  const onSubmit = async (values: EntryFormValues) => {
    setServerError(null);
    try {
      const result =
        props.mode === "edit"
          ? await updateLexicalEntryAction({ ...values, id: props.entry.id })
          : await createLexicalEntryAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      const saved = result.data;
      router.push(saved.isVerified ? entryPath(saved.slug) : `/admin/entries/${saved.id}`);
    } catch {
      setServerError("Failed to save entry. Please try again.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <BasicFields />
        <SensesFields />

        <FormError message={serverError} />

        <div className="flex space-x-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Saving..." : props.mode === "edit" ? "Save Changes" : "Create Entry"}
          </button>
          <FormCancelButton fallbackHref="/admin/entries" />
        </div>
      </form>
    </FormProvider>
  );
};

export { EntryEditForm };
