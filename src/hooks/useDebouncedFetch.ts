import { useEffect, useRef, useState } from "react";

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

const DEFAULT_DEBOUNCE_MS = 300;

interface UseDebouncedFetchOptions<T> {
  query: string;
  minQueryLength: number;
  debounceMs?: number;
  fetcher: (query: string, signal: AbortSignal) => Promise<T>;
  onSuccess: (data: T) => void;
  onError?: (error: unknown) => void;
  onIdle?: () => void;
}

export const useDebouncedFetch = <T>({
  query,
  minQueryLength,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  fetcher,
  onSuccess,
  onError,
  onIdle,
}: UseDebouncedFetchOptions<T>): boolean => {
  const [isLoading, setIsLoading] = useState(false);
  const trimmedQuery = query.trim();

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (trimmedQuery.length < minQueryLength) {
      setIsLoading(false);
      onIdleRef.current?.();
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(() => {
      fetcherRef
        .current(trimmedQuery, controller.signal)
        .then((data) => {
          onSuccessRef.current(data);
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }
          console.error(error);
          onErrorRef.current?.(error);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, minQueryLength, debounceMs]);

  return isLoading;
};
