import type { TextareaHTMLAttributes } from "react";
import { Field, type FieldErrorLike, type FieldRegistration, getFieldErrorProps } from "~/components/ui/Field";

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "onBlur" | "ref"> {
  label: string;
  error?: FieldErrorLike;
  registration: FieldRegistration<HTMLTextAreaElement>;
}

const TextAreaField = ({ label, error, registration, ...textareaProps }: TextAreaFieldProps) => (
  <Field id={textareaProps.id} label={label} error={error}>
    <textarea
      {...registration}
      {...textareaProps}
      {...getFieldErrorProps(textareaProps.id, error)}
      className="field-control h-24"
    />
  </Field>
);

export default TextAreaField;
