import { type KeyboardEvent, type MouseEvent, useState } from "react";
import useSenseSearch from "~/hooks/useSenseSearch";
import type { SenseSearchOption } from "~/lib/api/sense-search";
import { formatPartOfSpeechType } from "~/lib/formatting";
import type { LanguageType } from "~/server/db/schema";

interface AsyncSenseSelectProps {
  id: string;
  language: LanguageType;
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  placeholder: string;
  error?: string;
  inputRef?: (instance: HTMLInputElement | null) => void;
}

const OptionLabel = ({ option }: { option: SenseSearchOption }) => (
  <>
    <span lang={option.language}>{option.text}</span> ({formatPartOfSpeechType(option.pos)})
  </>
);

const keepInputFocus = (event: MouseEvent<HTMLElement>) => event.preventDefault();

const AsyncSenseSelect = ({
  id,
  language,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  inputRef,
}: AsyncSenseSelectProps) => {
  const {
    query,
    setQuery,
    options,
    selectedOption,
    selectOption,
    isLoading,
    isLoadingMore,
    hasMore,
    minQueryLength,
    loadMore,
  } = useSenseSearch(language, value);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listboxId = `${id}-listbox`;
  const selectedId = `${id}-selected`;
  const errorId = `${id}-error`;
  const optionId = (optionValue: number) => `${id}-option-${optionValue}`;

  const canSearch = query.trim().length >= minQueryLength;
  const showListbox = canSearch && !isLoading && options.length > 0;
  const activeOption = showListbox ? options[activeIndex] : undefined;
  const hasSelection = value > 0;

  const handleSelect = (option: SenseSearchOption) => {
    onChange(option.id);
    selectOption(option);
    setQuery("");
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeOption) {
        handleSelect(activeOption);
      }
      return;
    }
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
      setActiveIndex(-1);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && showListbox) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) =>
        index === -1 && step === -1 ? options.length - 1 : (index + step + options.length) % options.length,
      );
    }
  };

  const describedBy = [value > 0 ? selectedId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-2">
      <input
        id={id}
        ref={inputRef}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showListbox}
        aria-controls={showListbox ? listboxId : undefined}
        aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className="field-control"
      />

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {value > 0 && (
        <p id={selectedId} className="text-xs text-gray-700">
          Selected:{" "}
          {selectedOption && selectedOption.id === value ? <OptionLabel option={selectedOption} /> : `Sense #${value}`}
        </p>
      )}

      <div role="status" className="text-xs text-gray-600">
        {!canSearch
          ? !hasSelection && `Type at least ${minQueryLength} characters to search.`
          : isLoading
            ? "Loading senses..."
            : options.length === 0 && "No matching senses found."}
      </div>

      {showListbox && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Matching senses"
          className="border border-gray-300 divide-y divide-gray-100"
        >
          {options.map((option, index) => (
            <div
              key={option.id}
              id={optionId(option.id)}
              role="option"
              tabIndex={-1}
              aria-selected={index === activeIndex}
              onMouseDown={keepInputFocus}
              onClick={() => handleSelect(option)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSelect(option);
                }
              }}
              className={`w-full cursor-pointer text-left px-3 py-2 text-sm hover:bg-gray-50 ${index === activeIndex ? "bg-gray-100" : ""}`}
            >
              <OptionLabel option={option} />
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="text-xs text-blue-700 hover:underline disabled:opacity-50"
        >
          {isLoadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
};

export default AsyncSenseSelect;
