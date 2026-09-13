import Link from "next/link";
import type { FC } from "react";
import { formatMorphPatternFormNumber } from "~/lib/formatting";

interface FormReferenceProps {
  formNumber: number;
  formDescription?: string;
}

const FormReference: FC<FormReferenceProps> = ({ formNumber, formDescription }) => {
  const numeral = formatMorphPatternFormNumber(formNumber);
  const description = formDescription?.trim();

  return (
    <span className="whitespace-nowrap">
      <Link
        href={`/appendix/arabic-verbs#Form_${numeral}`}
        className="text-blue-600 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        Form {numeral}
      </Link>
      {description ? `, ${description}` : null}
    </span>
  );
};

FormReference.displayName = "FormReference";
export default FormReference;
