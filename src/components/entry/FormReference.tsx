import Link from "next/link";
import type { FC } from "react";
import { formatMorphPatternFormNumber } from "~/lib/formatting";

interface FormReferenceProps {
  formNumber: number;
  radicalCount?: number;
  formDescription?: string;
}

const FormReference: FC<FormReferenceProps> = ({ formNumber, radicalCount = 3, formDescription }) => {
  const numeral = formatMorphPatternFormNumber(formNumber, radicalCount);
  const description = formDescription?.trim();
  const anchor = radicalCount === 4 ? "" : `#Form_${numeral}`;

  return (
    <span className="whitespace-nowrap">
      <Link href={`/appendix/arabic-verbs${anchor}`} className="text-blue-600 underline hover:text-blue-800">
        Form {numeral}
      </Link>
      {description ? `, ${description}` : null}
    </span>
  );
};

FormReference.displayName = "FormReference";
export default FormReference;
