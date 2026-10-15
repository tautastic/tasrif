"use client";

import { type KeyboardEvent, useId, useState } from "react";
import {
  addContextTags,
  hasTagSeparator,
  MAX_CONTEXT_TAG_LENGTH,
  MAX_CONTEXT_TAGS,
} from "~/lib/validation/contextTags";

interface ContextTagsInputProps {
  id: string;
  label: string;
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  onBlur: () => void;
  error?: string;
}

const ContextTagsInput = ({ id, label, tags, onChange, onBlur, error }: ContextTagsInputProps) => {
  const [pending, setPending] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const hintId = useId();
  const errorId = `${id}-error`;
  const message = localError ?? error;

  const commit = (raw: string) => {
    if (raw.trim() === "") {
      setPending("");
      return;
    }
    const result = addContextTags(tags, raw);
    if (result.error !== null) {
      setLocalError(result.error);
      setPending(raw);
      return;
    }
    const added = result.tags.filter((tag) => !tags.includes(tag));
    setLocalError(null);
    setPending("");
    onChange(result.tags);
    setStatus(added.length > 0 ? `Added ${added.join(", ")}` : "Already in the list");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(pending);
    }
  };

  const remove = (tag: string) => {
    onChange(tags.filter((candidate) => candidate !== tag));
    setStatus(`Removed ${tag}`);
    document.getElementById(id)?.focus();
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {tags.length > 0 && (
        <ul aria-label={`${label} added`} className="mb-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">
              <span dir="auto">{tag}</span>
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove tag ${tag}`}
                className="px-1 text-gray-700 hover:text-red-700"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="text"
        value={pending}
        onChange={(event) => {
          const next = event.target.value;
          setLocalError(null);
          if (hasTagSeparator(next)) {
            commit(next);
          } else {
            setPending(next);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          commit(pending);
          onBlur();
        }}
        aria-describedby={message ? `${hintId} ${errorId}` : hintId}
        aria-invalid={message ? true : undefined}
        dir="auto"
        className="field-control"
        autoComplete="off"
      />
      <p id={hintId} className="text-gray-600 text-xs mt-1">
        Press Enter or type a comma to add a tag. Up to {MAX_CONTEXT_TAGS} tags of {MAX_CONTEXT_TAG_LENGTH} characters.
      </p>
      {message && (
        <p id={errorId} role="alert" className="text-red-700 text-sm mt-1">
          {message}
        </p>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
};

export default ContextTagsInput;
