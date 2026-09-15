import { useState } from "react";
import { useDebouncedFetch } from "~/hooks/useDebouncedFetch";
import type { VerbFormResolutionResponse } from "~/lib/api/verb-form";
import type { VerbFormChoice } from "~/lib/validation/verbFormChoice";

const MIN_ROOT_LENGTH = 3;

const fetchResolution = async (
  root: string,
  formChoice: VerbFormChoice | null,
  signal: AbortSignal,
): Promise<VerbFormResolutionResponse> => {
  const params = new URLSearchParams({ root });
  if (formChoice) {
    params.set("formChoice", formChoice);
  }
  const response = await fetch(`/api/verb-form/resolve?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Verb form resolution failed with status ${response.status}`);
  }
  return (await response.json()) as VerbFormResolutionResponse;
};

export const useVerbFormResolution = (
  root: string,
  formChoice: VerbFormChoice | null,
): VerbFormResolutionResponse | null => {
  const [result, setResult] = useState<VerbFormResolutionResponse | null>(null);
  const trimmedRoot = root.trim();

  useDebouncedFetch({
    query: `${trimmedRoot}|${formChoice ?? ""}`,
    minQueryLength: MIN_ROOT_LENGTH,
    fetcher: (_, signal) => fetchResolution(trimmedRoot, formChoice, signal),
    onSuccess: setResult,
    onError: () => setResult(null),
    onIdle: () => setResult(null),
  });

  return result;
};
