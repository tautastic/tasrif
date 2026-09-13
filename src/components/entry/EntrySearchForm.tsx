"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { EntrySearchResponse, EntrySearchResult } from "~/lib/api/entry-search";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 1;

const EntrySearchForm = () => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntrySearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const showDropdown = isOpen && trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/entries/search?query=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Entry search failed with status ${response.status}`);
          }
          return response.json() as Promise<EntrySearchResponse>;
        })
        .then((data) => {
          setResults(data.items);
          setActiveIndex(-1);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          console.error(error);
          setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const reset = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const navigateTo = (result: EntrySearchResult) => {
    reset();
    router.push(`/entry/${result.normalizedText}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) {
        return;
      }
      setIsOpen(true);
      setActiveIndex((index) => (index + 1 >= results.length ? 0 : index + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) {
        return;
      }
      setIsOpen(true);
      setActiveIndex((index) => (index - 1 < 0 ? results.length - 1 : index - 1));
      return;
    }

    if (event.key === "Enter") {
      const target = results[activeIndex];
      if (target) {
        event.preventDefault();
        navigateTo(target);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <search className="w-full">
        <form onSubmit={(event) => event.preventDefault()} className="flex w-full">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search Dictionary"
            aria-label="Search Dictionary"
            lang="ar"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="entry-search-results"
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 && results[activeIndex] ? `entry-search-option-${results[activeIndex].id}` : undefined
            }
            autoComplete="off"
            className="w-full border text-sm border-gray-300 px-4 h-min py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </search>

      {showDropdown && (
        <div
          id="entry-search-results"
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto border border-gray-200 bg-white shadow-lg"
        >
          {isLoading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No entries found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  id={`entry-search-option-${result.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    navigateTo(result);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  lang={result.language}
                  className={`cursor-pointer px-4 py-2 text-sm hover:bg-gray-50 ${
                    index === activeIndex ? "bg-gray-50" : ""
                  }`}
                >
                  {result.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EntrySearchForm;
