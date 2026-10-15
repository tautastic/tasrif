"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, FC } from "react";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import type { MorphPatternLexicalFilterValue } from "~/server/db/repository/morph-pattern";

const FORM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const QUADRILITERAL_FORM_NUMBERS = [1, 2, 3, 4] as const;

interface MorphPatternFilterSelectionProps {
  formNumber: number | undefined;
  radicalCount: number | undefined;
  lexicalFilter: MorphPatternLexicalFilterValue;
  lexicalFilterOptions: readonly MorphPatternLexicalFilterValue[];
}

const MorphPatternFilterSelection: FC<MorphPatternFilterSelectionProps> = ({
  formNumber,
  radicalCount,
  lexicalFilter,
  lexicalFilterOptions,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const formKey = formNumber === undefined ? "" : `${formNumber}${radicalCount === 4 ? "q" : ""}`;

  const navigate = (next: { formKey?: string; lexicalFilter: MorphPatternLexicalFilterValue }) => {
    const params = new URLSearchParams();
    if (next.formKey !== undefined) {
      params.set("formNumber", next.formKey);
    }
    if (next.lexicalFilter !== "All") {
      params.set("lexicalFilter", next.lexicalFilter);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleFormNumberChange = (e: ChangeEvent<HTMLSelectElement>) => {
    navigate({
      formKey: e.target.value === "" ? undefined : e.target.value,
      lexicalFilter,
    });
  };

  const handleLexicalFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    navigate({
      formKey: formKey === "" ? undefined : formKey,
      lexicalFilter: e.target.value as MorphPatternLexicalFilterValue,
    });
  };

  const selectClassName = "border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700";

  return (
    <div className="flex flex-wrap gap-3">
      <select
        aria-label="Filter patterns by verb form"
        value={formKey}
        onChange={handleFormNumberChange}
        className={selectClassName}
      >
        <option value="">All forms</option>
        {FORM_NUMBERS.map((n) => (
          <option key={n} value={n}>
            Form {formatMorphPatternFormNumber(n)}
          </option>
        ))}
        {QUADRILITERAL_FORM_NUMBERS.map((n) => (
          <option key={`${n}q`} value={`${n}q`}>
            Form {formatMorphPatternFormNumber(n, 4)}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter patterns by type"
        value={lexicalFilter}
        onChange={handleLexicalFilterChange}
        className={selectClassName}
      >
        {lexicalFilterOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

MorphPatternFilterSelection.displayName = "MorphPatternFilterSelection";
export default MorphPatternFilterSelection;
