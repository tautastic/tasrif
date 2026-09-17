import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedFetch } from "~/hooks/useDebouncedFetch";
import {
  SENSE_SEARCH_DEFAULT_LIMIT,
  SENSE_SEARCH_MIN_QUERY_LENGTH,
  type SenseSearchOption,
  type SenseSearchResponse,
} from "~/lib/api/sense-search";
import type { LanguageType } from "~/server/db/schema";

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
  const [options, setOptions] = useState<SenseSearchOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<SenseSearchOption | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const resolvedSenseId = useRef<number | null>(null);
  const selectOption = useCallback((option: SenseSearchOption | null) => {
    resolvedSenseId.current = option?.id ?? null;
    setSelectedOption(option);
  }, []);

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

  const isLoading = useDebouncedFetch({
    query,
    minQueryLength: SENSE_SEARCH_MIN_QUERY_LENGTH,
    fetcher: (trimmedQuery, signal) =>
      fetchSenses({ query: trimmedQuery, language, limit: String(SENSE_SEARCH_DEFAULT_LIMIT), page: "1" }, signal),
    onSuccess: (data) => {
      setOptions(data.items);
      setHasMore(data.hasMore);
      setPage(1);
    },
    onError: () => {
      setOptions([]);
      setHasMore(false);
    },
    onIdle: () => {
      setOptions([]);
      setHasMore(false);
      setPage(1);
    },
  });

  const loadMoreControllerRef = useRef<AbortController | null>(null);

  const loadMore = useCallback(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < SENSE_SEARCH_MIN_QUERY_LENGTH || !hasMore || isLoadingMore) {
      return;
    }

    const nextPage = page + 1;
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setIsLoadingMore(true);

    fetchSenses(
      { query: trimmedQuery, language, limit: String(SENSE_SEARCH_DEFAULT_LIMIT), page: String(nextPage) },
      controller.signal,
    )
      .then((data) => {
        setOptions((previous) => [...previous, ...data.items]);
        setHasMore(data.hasMore);
        setPage(nextPage);
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          console.error(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingMore(false);
        }
      });
  }, [query, language, hasMore, isLoadingMore, page]);

  useEffect(() => {
    return () => {
      loadMoreControllerRef.current?.abort();
    };
  }, [query, language]);

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
