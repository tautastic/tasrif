"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import BasicFields from "~/components/admin/entry-edit-form/BasicFields";
import SensesFields from "~/components/admin/entry-edit-form/SensesFields";
import { type EntryFormInput, type EntryFormValues, entryFormSchema } from "~/components/admin/entry-edit-form/schema";
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
    try {
      const saved =
        props.mode === "edit"
          ? await updateLexicalEntryAction({ ...values, id: props.entry.id })
          : await createLexicalEntryAction(values);
      router.push(saved.isVerified ? `/entry/${saved.normalizedText}` : `/admin/entries/${saved.id}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save entry.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <BasicFields />
        <SensesFields />

        {serverError && <p className="text-red-600">{serverError}</p>}

        <div className="flex space-x-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Saving..." : props.mode === "edit" ? "Save Changes" : "Create Entry"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </FormProvider>
  );
};

export { EntryEditForm };
