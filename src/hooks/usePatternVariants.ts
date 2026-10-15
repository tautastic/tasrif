import { useState } from "react";
import { useDebouncedFetch } from "~/hooks/useDebouncedFetch";
import type { PatternVariantsResponse } from "~/lib/api/pattern-variants";
import type { VerbFormChoice } from "~/lib/validation/verbFormChoice";

const MIN_ROOT_LENGTH = 3;

const NO_VARIANTS: PatternVariantsResponse = { variants: [], current: null };

const fetchVariants = async (
  root: string,
  formChoice: VerbFormChoice | null,
  entryId: number | null,
  signal: AbortSignal,
): Promise<PatternVariantsResponse> => {
  if (!formChoice) {
    return NO_VARIANTS;
  }
  const params = new URLSearchParams({ root, formChoice });
  if (entryId !== null) {
    params.set("entryId", String(entryId));
  }
  const response = await fetch(`/api/verb-form/variants?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Pattern variant lookup failed with status ${response.status}`);
  }
  return (await response.json()) as PatternVariantsResponse;
};

export const usePatternVariants = (
  root: string,
  formChoice: VerbFormChoice | null,
  entryId: number | null,
): PatternVariantsResponse | null => {
  const [result, setResult] = useState<{ key: string; data: PatternVariantsResponse } | null>(null);
  const trimmedRoot = root.trim();
  const key =
    formChoice && trimmedRoot.length >= MIN_ROOT_LENGTH ? `${trimmedRoot}|${formChoice}|${entryId ?? ""}` : "";

  useDebouncedFetch({
    query: key,
    minQueryLength: 1,
    fetcher: (_, signal) => fetchVariants(trimmedRoot, formChoice, entryId, signal),
    onSuccess: (data) => setResult({ key, data }),
    onError: () => setResult(null),
    onIdle: () => setResult(null),
  });

  return result?.key === key ? result.data : null;
};
