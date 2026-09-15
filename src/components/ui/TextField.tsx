import type { InputHTMLAttributes } from "react";
import { Field, type FieldErrorLike, type FieldRegistration } from "~/components/ui/Field";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "ref"> {
  label: string;
  error?: FieldErrorLike;
  registration: FieldRegistration<HTMLInputElement>;
}

const TextField = ({ label, error, registration, ...inputProps }: TextFieldProps) => (
  <Field id={inputProps.id} label={label} error={error}>
    <input {...registration} {...inputProps} className="field-control" />
  </Field>
);

export default TextField;
