import type { ChangeEvent, FocusEvent, ReactNode } from "react";

export type FieldErrorLike = string | { message?: string } | null;

export interface FieldRegistration<E extends HTMLElement> {
  name: string;
  onChange: (event: ChangeEvent<E>) => void;
  onBlur: (event: FocusEvent<E>) => void;
  ref: (instance: E | null) => void;
  value?: string | number | readonly string[];
}

interface FieldProps {
  id?: string;
  label: string;
  error?: FieldErrorLike;
  hint?: string;
  children: ReactNode;
}

const getErrorMessage = (error: FieldErrorLike | undefined): string | undefined =>
  typeof error === "string" ? error : error?.message;

export const getFieldErrorId = (id: string | undefined): string | undefined => (id ? `${id}-error` : undefined);

export const getFieldHintId = (id: string | undefined): string | undefined => (id ? `${id}-hint` : undefined);

export const getFieldDescriptionProps = (id: string | undefined, error: FieldErrorLike | undefined, hint?: string) => {
  const hasError = Boolean(getErrorMessage(error));
  const describedBy = [hasError ? getFieldErrorId(id) : undefined, hint ? getFieldHintId(id) : undefined]
    .filter((value): value is string => value !== undefined)
    .join(" ");
  return {
    ...(hasError ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };
};

export const getFieldErrorProps = (id: string | undefined, error: FieldErrorLike | undefined) =>
  getFieldDescriptionProps(id, error);

export const Field = ({ id, label, error, hint, children }: FieldProps) => {
  const message = getErrorMessage(error);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {children}
      {hint && (
        <p id={getFieldHintId(id)} className="text-gray-600 text-xs mt-1">
          {hint}
        </p>
      )}
      {message && (
        <p id={getFieldErrorId(id)} role="alert" className="text-red-700 text-sm mt-1">
          {message}
        </p>
      )}
    </div>
  );
};
