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
  children: ReactNode;
}

export const Field = ({ id, label, error, children }: FieldProps) => {
  const message = typeof error === "string" ? error : error?.message;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {children}
      {message && <p className="text-red-600 text-sm mt-1">{message}</p>}
    </div>
  );
};
