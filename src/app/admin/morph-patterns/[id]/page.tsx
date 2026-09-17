import Link from "next/link";
import { notFound } from "next/navigation";
import PatternPreviewPanel from "~/components/admin/PatternPreviewPanel";
import { formatMorphPatternFormNumber } from "~/lib/formatting";
import { parseIdOrNotFound } from "~/lib/validation/params";
import { listOverridesForPattern } from "~/server/db/repository/lexical-pattern-override";
import { getMorphPatternById, getMorphPatternUsageCounts } from "~/server/db/repository/morph-pattern";

export default async function MorphPatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const patternId = await parseIdOrNotFound(params);
  const pattern = await getMorphPatternById(patternId);

  if (!pattern) {
    notFound();
  }

  const [usage, overrides] = await Promise.all([
    getMorphPatternUsageCounts(patternId),
    listOverridesForPattern(patternId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-bold sm:text-2xl" lang="ar" dir="rtl">
          {pattern.vocalicTemplate}
        </h1>
        <span className="text-sm text-gray-600">
          Form {formatMorphPatternFormNumber(pattern.formNumber)}
          {pattern.description ? ` — ${pattern.description}` : ""}
        </span>
        <Link href={`/admin/morph-patterns/${patternId}/edit`} className="text-sm text-blue-600 hover:underline">
          Edit
        </Link>
        <Link href={`/admin/morph-patterns/${patternId}/delete`} className="text-sm text-red-600 hover:underline">
          Delete
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Radicals</dt>
          <dd>
            {pattern.radical1Kind} / {pattern.radical2Kind} / {pattern.radical3Kind}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Geminate</dt>
          <dd>{pattern.isGeminate ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">No-affix</dt>
          <dd>{pattern.noAffix ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Lexical</dt>
          <dd>{pattern.isLexical ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Perfect / imperfect vowel</dt>
          <dd>
            {pattern.perfectVowel ?? "—"} / {pattern.imperfectVowel ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Used by</dt>
          <dd>
            {usage.entryCount} {usage.entryCount === 1 ? "entry" : "entries"}, {usage.overrideCount}{" "}
            {usage.overrideCount === 1 ? "override" : "overrides"}
          </dd>
        </div>
      </dl>

      <PatternPreviewPanel rules={pattern.rules} formNumber={pattern.formNumber} noAffix={pattern.noAffix} />

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Overrides</h2>
          <Link
            href={`/admin/morph-patterns/${patternId}/overrides/new`}
            className="text-sm text-blue-600 hover:underline"
          >
            Add override
          </Link>
        </div>
        {overrides.length === 0 ? (
          <p className="text-sm text-gray-500">
            {pattern.isLexical
              ? "No overrides yet — this lexical pattern is unreachable until at least one root is pointed at it."
              : "No overrides yet."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">Root</th>
                <th className="py-2 pr-4 font-medium">Form</th>
                <th className="py-2 pr-4 font-medium">Vowels</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {overrides.map((override) => (
                <tr key={override.id}>
                  <td className="py-1.5 pr-4" lang="ar" dir="rtl">
                    {override.root}
                  </td>
                  <td className="py-1.5 pr-4">{formatMorphPatternFormNumber(override.formNumber)}</td>
                  <td className="py-1.5 pr-4">
                    {override.perfectVowel ?? "—"} / {override.imperfectVowel ?? "—"}
                  </td>
                  <td className="py-1.5 whitespace-nowrap">
                    <Link
                      href={`/admin/morph-patterns/${patternId}/overrides/${override.id}/edit`}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>{" "}
                    <Link
                      href={`/admin/morph-patterns/${patternId}/overrides/${override.id}/delete`}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
