interface AlternativeFormsProps {
  forms: readonly string[];
}

const AlternativeForms = ({ forms }: AlternativeFormsProps) =>
  forms.length === 0 ? null : (
    <ul className="mt-1 space-y-0.5 text-sm text-gray-700" aria-label="Alternative forms">
      {forms.map((form) => (
        <li key={form}>
          <span lang="ar">{form}</span>
        </li>
      ))}
    </ul>
  );

export default AlternativeForms;
