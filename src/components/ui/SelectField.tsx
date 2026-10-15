import type { ReactNode, SelectHTMLAttributes } from "react";
import { Field, type FieldErrorLike, type FieldRegistration, getFieldErrorProps } from "~/components/ui/Field";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "onBlur" | "ref"> {
  label: string;
  error?: FieldErrorLike;
  registration: FieldRegistration<HTMLSelectElement>;
  children: ReactNode;
}

const SelectField = ({ label, error, registration, children, ...selectProps }: SelectFieldProps) => (
  <Field id={selectProps.id} label={label} error={error}>
    <select {...registration} {...selectProps} {...getFieldErrorProps(selectProps.id, error)} className="field-control">
      {children}
    </select>
  </Field>
);

export default SelectField;
