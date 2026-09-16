import type { Person } from "~/lib/validation/morphPatternRules";

export const PERSON_LABELS: Record<Person, string> = {
  first_person_singular: "1sg",
  second_person_masculine_singular: "2sg.m",
  second_person_feminine_singular: "2sg.f",
  third_person_masculine_singular: "3sg.m",
  third_person_feminine_singular: "3sg.f",
  second_person_dual: "2dual",
  third_person_masculine_dual: "3dual.m",
  third_person_feminine_dual: "3dual.f",
  first_person_plural: "1pl",
  second_person_masculine_plural: "2pl.m",
  second_person_feminine_plural: "2pl.f",
  third_person_masculine_plural: "3pl.m",
  third_person_feminine_plural: "3pl.f",
};

interface PersonFormsGridProps {
  idPrefix: string;
  persons: readonly Person[];
  value: Partial<Record<Person, string>> | undefined;
  onChange: (next: Partial<Record<Person, string>>) => void;
}

const PersonFormsGrid = ({ idPrefix, persons, value, onChange }: PersonFormsGridProps) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {persons.map((person) => (
      <div key={person}>
        <label htmlFor={`${idPrefix}-${person}`} className="block text-xs text-gray-600 mb-0.5">
          {PERSON_LABELS[person]}
        </label>
        <input
          id={`${idPrefix}-${person}`}
          type="text"
          lang="ar"
          dir="rtl"
          className="field-control"
          value={value?.[person] ?? ""}
          onChange={(e) => onChange({ ...value, [person]: e.target.value })}
        />
      </div>
    ))}
  </div>
);

export default PersonFormsGrid;
