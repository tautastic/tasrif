import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { buildPageMetadata } from "~/app/site";
import { formatCount, formatMorphPatternFormNumber } from "~/lib/formatting";
import { getCachedVerbForms } from "~/server/cache/public-queries";

export const metadata: Metadata = buildPageMetadata({
  title: "Arabic Verb Forms",
  description: "The derived verb forms of Arabic, with the number of dictionary entries for each.",
  path: "/arabic-verb-form",
});

export default async function ArabicVerbFormsPage() {
  await connection();
  const forms = await getCachedVerbForms();

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Arabic Verb Forms</h1>
      <p className="text-sm text-gray-600 mb-4">
        The following {formatCount(forms.length, "form", "forms")} {forms.length === 1 ? "is" : "are"} available:
      </p>

      <ul className="grid grid-cols-2 list-disc gap-x-4 gap-y-3 pl-6 text-sm md:text-base md:grid-cols-3">
        {forms.map((form) => (
          <li key={`${form.formNumber}${form.radicalCount === 4 ? "q" : ""}`}>
            <Link
              href={`/arabic-verb-form/${form.formNumber}${form.radicalCount === 4 ? "q" : ""}`}
              className="text-blue-600 underline hover:text-blue-800"
            >
              Form {formatMorphPatternFormNumber(form.formNumber, form.radicalCount)}
            </Link>
            <span className="text-gray-600 text-sm"> ({formatCount(form.total, "entry", "entries")})</span>
          </li>
        ))}
      </ul>
    </>
  );
}
