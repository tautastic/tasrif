import type { InputHTMLAttributes } from "react";
import { Field, type FieldErrorLike, type FieldRegistration, getFieldDescriptionProps } from "~/components/ui/Field";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "ref"> {
  label: string;
  error?: FieldErrorLike;
  hint?: string;
  registration: FieldRegistration<HTMLInputElement>;
}

const TextField = ({ label, error, hint, registration, ...inputProps }: TextFieldProps) => (
  <Field id={inputProps.id} label={label} error={error} hint={hint}>
    <input
      {...registration}
      {...inputProps}
      {...getFieldDescriptionProps(inputProps.id, error, hint)}
      className="field-control"
    />
  </Field>
);

export default TextField;
