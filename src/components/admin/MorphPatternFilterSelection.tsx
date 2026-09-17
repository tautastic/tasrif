"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, FC } from "react";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import type { MorphPatternLexicalFilterValue } from "~/server/db/repository/morph-pattern";

const FORM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface MorphPatternFilterSelectionProps {
  formNumber: number | undefined;
  lexicalFilter: MorphPatternLexicalFilterValue;
  lexicalFilterOptions: readonly MorphPatternLexicalFilterValue[];
}

const MorphPatternFilterSelection: FC<MorphPatternFilterSelectionProps> = ({
  formNumber,
  lexicalFilter,
  lexicalFilterOptions,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (next: { formNumber?: number; lexicalFilter: MorphPatternLexicalFilterValue }) => {
    const params = new URLSearchParams();
    if (next.formNumber !== undefined) {
      params.set("formNumber", String(next.formNumber));
    }
    if (next.lexicalFilter !== "All") {
      params.set("lexicalFilter", next.lexicalFilter);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleFormNumberChange = (e: ChangeEvent<HTMLSelectElement>) => {
    navigate({
      formNumber: e.target.value === "" ? undefined : Number(e.target.value),
      lexicalFilter,
    });
  };

  const handleLexicalFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    navigate({ formNumber, lexicalFilter: e.target.value as MorphPatternLexicalFilterValue });
  };

  const selectClassName = "mb-4 border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700";

  return (
    <div className="flex flex-wrap gap-3">
      <select value={formNumber ?? ""} onChange={handleFormNumberChange} className={selectClassName}>
        <option value="">All forms</option>
        {FORM_NUMBERS.map((n) => (
          <option key={n} value={n}>
            Form {formatMorphPatternFormNumber(n)}
          </option>
        ))}
      </select>

      <select value={lexicalFilter} onChange={handleLexicalFilterChange} className={selectClassName}>
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
