"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useState } from "react";
import { useDebouncedFetch } from "~/hooks/useDebouncedFetch";
import type { EntrySearchResponse, EntrySearchResult } from "~/lib/api/entry-search";
import { entryPath, formatCount } from "~/lib/formatting";

const MIN_QUERY_LENGTH = 2;
const LISTBOX_ID = "entry-search-results";

const optionId = (index: number) => `entry-search-option-${index}`;

const preventFocusLoss = (event: MouseEvent<HTMLElement>) => event.preventDefault();

const isModifiedClick = (event: MouseEvent<HTMLElement>) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

const fetchEntries = async (query: string, signal: AbortSignal): Promise<EntrySearchResult[]> => {
  const response = await fetch(`/api/entries/search?query=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) {
    throw new Error(`Entry search failed with status ${response.status}`);
  }
  const data = (await response.json()) as EntrySearchResponse;
  return data.items;
};

const EntrySearchForm = () => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntrySearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const showListbox = isOpen && canSearch && results.length > 0;
  const showMessage = isOpen && canSearch && results.length === 0;
  const optionCount = results.length + 1;
  const searchHref = `/search?${new URLSearchParams({ q: trimmedQuery })}`;

  const isLoading = useDebouncedFetch({
    query,
    minQueryLength: MIN_QUERY_LENGTH,
    fetcher: fetchEntries,
    onSuccess: (items) => {
      setResults(items);
      setActiveIndex(-1);
    },
    onError: () => {
      setResults([]);
    },
    onIdle: () => {
      setResults([]);
      setActiveIndex(-1);
    },
  });

  useEffect(() => {
    if (activeIndex >= 0) {
      document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const reset = () => {
    setQuery("");
    setResults([]);
    close();
  };

  const handleLinkClick = (event: MouseEvent<HTMLElement>) => {
    if (!isModifiedClick(event)) {
      reset();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = showListbox ? results[activeIndex] : undefined;
    if (target) {
      reset();
      router.push(entryPath(target.slug));
      return;
    }
    if (trimmedQuery) {
      reset();
      router.push(searchHref);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (isOpen && canSearch) {
        event.preventDefault();
        close();
      } else if (query) {
        event.preventDefault();
        setQuery("");
      }
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    if (!canSearch || results.length === 0) {
      return;
    }
    if (!showListbox) {
      setIsOpen(true);
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActiveIndex((index) =>
      index === -1 && step === -1 ? optionCount - 1 : (index + step + optionCount) % optionCount,
    );
  };

  const optionClassName = (index: number) =>
    `block cursor-pointer px-4 py-2 text-sm hover:bg-gray-50 ${index === activeIndex ? "bg-gray-100" : ""}`;

  let statusMessage = "";
  if (showMessage) {
    statusMessage = isLoading ? "Searching…" : "No entries found.";
  } else if (showListbox) {
    statusMessage = `${formatCount(results.length, "suggestion", "suggestions")} available.`;
  }

  return (
    <div className="relative w-full">
      <search className="w-full" aria-label="Site search">
        <form action="/search" method="get" onSubmit={handleSubmit} className="flex w-full">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={close}
            onKeyDown={handleKeyDown}
            placeholder="Search Dictionary"
            aria-label="Search Dictionary"
            dir="auto"
            role="combobox"
            aria-expanded={showListbox}
            aria-controls={showListbox ? LISTBOX_ID : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showListbox && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full border text-sm border-gray-300 px-4 h-min py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </search>

      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </div>

      {(showListbox || showMessage) && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto border border-gray-200 bg-white shadow-lg">
          {showMessage && (
            <p className="px-4 py-3 text-sm text-gray-600" aria-hidden="true">
              {isLoading ? "Searching..." : "No entries found."}
            </p>
          )}
          {showListbox && (
            <div id={LISTBOX_ID} role="listbox" aria-label="Search suggestions" className="divide-y divide-gray-100">
              {results.map((result, index) => (
                <Link
                  key={result.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  prefetch={false}
                  href={entryPath(result.slug)}
                  onClick={handleLinkClick}
                  onMouseDown={preventFocusLoss}
                  onMouseEnter={() => setActiveIndex(index)}
                  lang={result.language}
                  className={optionClassName(index)}
                >
                  {result.text}
                </Link>
              ))}
              <Link
                id={optionId(results.length)}
                role="option"
                aria-selected={activeIndex === results.length}
                tabIndex={-1}
                prefetch={false}
                href={searchHref}
                onClick={handleLinkClick}
                onMouseDown={preventFocusLoss}
                onMouseEnter={() => setActiveIndex(results.length)}
                className={`${optionClassName(results.length)} text-blue-700`}
              >
                See all results for “{trimmedQuery}”
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EntrySearchForm;
