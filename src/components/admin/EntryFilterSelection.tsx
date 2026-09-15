"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, FC } from "react";

const EntryFilterSelection: FC<{ value: string; options: readonly string[] }> = ({ value, options }) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    router.push(`${pathname}?filter=${encodeURIComponent(e.target.value)}`);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      className="mb-4 border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
    >
      {options.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
};

EntryFilterSelection.displayName = "EntryFilterSelection";
export default EntryFilterSelection;
