import Link from "next/link";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { getVerbFormsWithCounts } from "~/server/db/repository/morph-pattern";

export default async function ArabicVerbFormsPage() {
  const forms = await getVerbFormsWithCounts();

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Arabic Verb Forms</h1>
      <p className="text-sm text-gray-600 mb-4">The following {forms.length} forms are available:</p>

      <ul className="grid grid-cols-2 list-disc gap-x-4 gap-y-3 pl-6 text-sm md:text-base md:grid-cols-3">
        {forms.map((form) => (
          <li key={form.formNumber}>
            <Link href={`/arabic-verb-form/${form.formNumber}`} className="text-blue-600 hover:underline">
              Form {formatMorphPatternFormNumber(form.formNumber)}
            </Link>
            <span className="text-gray-500 text-sm"> ({form.total} entries)</span>
          </li>
        ))}
      </ul>
    </>
  );
}
