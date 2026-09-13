import { useCallback, useEffect, useRef, useState } from "react";
import {
  SENSE_SEARCH_DEFAULT_LIMIT,
  SENSE_SEARCH_MIN_QUERY_LENGTH,
  type SenseSearchOption,
  type SenseSearchResponse,
} from "~/lib/api/sense-search";
import type { LanguageType } from "~/server/db/schema";

const DEBOUNCE_MS = 300;

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

const fetchSenses = async (params: Record<string, string>, signal?: AbortSignal): Promise<SenseSearchResponse> => {
  const response = await fetch(`/api/senses/search?${new URLSearchParams(params)}`, { signal });
  if (!response.ok) {
    throw new Error(`Sense search failed with status ${response.status}`);
  }
  return (await response.json()) as SenseSearchResponse;
};

interface UseSenseSearchResult {
  query: string;
  setQuery: (value: string) => void;
  options: SenseSearchOption[];
  selectedOption: SenseSearchOption | null;
  selectOption: (option: SenseSearchOption | null) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  minQueryLength: number;
  loadMore: () => void;
}

const useSenseSearch = (language: LanguageType, selectedSenseId: number): UseSenseSearchResult => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [options, setOptions] = useState<SenseSearchOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<SenseSearchOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const resolvedSenseId = useRef<number | null>(null);
  const selectOption = useCallback((option: SenseSearchOption | null) => {
    resolvedSenseId.current = option?.id ?? null;
    setSelectedOption(option);
  }, []);

  const isSearchable = debouncedQuery.length >= SENSE_SEARCH_MIN_QUERY_LENGTH;
  const searchParams = {
    query: debouncedQuery,
    language,
    limit: String(SENSE_SEARCH_DEFAULT_LIMIT),
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (selectedSenseId <= 0) {
      selectOption(null);
      return;
    }
    if (resolvedSenseId.current === selectedSenseId) {
      return;
    }

    const controller = new AbortController();
    resolvedSenseId.current = selectedSenseId;

    fetchSenses({ ids: String(selectedSenseId) }, controller.signal)
      .then((data) => {
        const [option] = data.items;
        if (option) {
          setSelectedOption(option);
        }
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          resolvedSenseId.current = null;
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [selectedSenseId, selectOption]);

  useEffect(() => {
    if (!isSearchable) {
      setOptions([]);
      setHasMore(false);
      setIsLoading(false);
      setPage(1);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetchSenses({ ...searchParams, page: "1" }, controller.signal)
      .then((data) => {
        setOptions(data.items);
        setHasMore(data.hasMore);
        setPage(1);
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }
        console.error(error);
        setOptions([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [isSearchable, debouncedQuery, language]);

  const loadMore = useCallback(() => {
    if (!isSearchable || !hasMore || isLoadingMore) {
      return;
    }

    const nextPage = page + 1;
    setIsLoadingMore(true);

    fetchSenses({ ...searchParams, page: String(nextPage) })
      .then((data) => {
        setOptions((previous) => [...previous, ...data.items]);
        setHasMore(data.hasMore);
        setPage(nextPage);
      })
      .catch((error: unknown) => console.error(error))
      .finally(() => setIsLoadingMore(false));
  }, [isSearchable, hasMore, isLoadingMore, page, debouncedQuery, language]);

  return {
    query,
    setQuery,
    options,
    selectedOption,
    selectOption,
    isLoading,
    isLoadingMore,
    hasMore,
    minQueryLength: SENSE_SEARCH_MIN_QUERY_LENGTH,
    loadMore,
  };
};

export default useSenseSearch;
