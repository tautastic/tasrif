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
}

const formatOptionLabel = (option: SenseSearchOption) => `${option.text} (${formatPartOfSpeechType(option.pos)})`;

const AsyncSenseSelect = ({ id, language, value, onChange, onBlur, placeholder }: AsyncSenseSelectProps) => {
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

  const selectedLabel =
    selectedOption && selectedOption.id === value
      ? formatOptionLabel(selectedOption)
      : value > 0
        ? `Sense #${value}`
        : null;

  return (
    <div className="space-y-2">
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="field-control"
      />

      {selectedLabel && <p className="text-xs text-gray-600">Selected: {selectedLabel}</p>}

      {query.trim().length < minQueryLength ? (
        <p className="text-xs text-gray-500">Type at least {minQueryLength} characters to search.</p>
      ) : isLoading ? (
        <p className="text-xs text-gray-500">Loading senses...</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-gray-500">No matching senses found.</p>
      ) : (
        <div className="border border-gray-300 divide-y divide-gray-100">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                selectOption(option);
                setQuery(formatOptionLabel(option));
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {formatOptionLabel(option)}
            </button>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {isLoadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
};

export default AsyncSenseSelect;
