import { NextResponse } from "next/server";
import { z } from "zod";
import type { VerbFormResolutionResponse } from "~/lib/api/verb-form";
import { countRadicals, normalizeRoot, QUADRILITERAL_ROOT_RADICALS } from "~/lib/validation/root";
import { type RadicalCount, verbFormChoiceRadicalCount, verbFormChoiceSchema } from "~/lib/validation/verbFormChoice";
import { parseQuery } from "~/server/api/query";
import { requireAdminApi } from "~/server/auth/guard";
import { describeVerbRoot, resolveVerbMorphPattern } from "~/server/db/repository/morph-pattern";

const VERB_FORM_MAX_ROOT_LENGTH = 100;

const querySchema = z.object({
  root: z.string().trim().min(1).max(VERB_FORM_MAX_ROOT_LENGTH),
  formChoice: verbFormChoiceSchema.optional(),
});

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(querySchema, searchParams);
  if (parsed.response) {
    return parsed.response;
  }

  const { root, formChoice } = parsed.data;
  const radicalCount: RadicalCount = formChoice
    ? verbFormChoiceRadicalCount(formChoice)
    : countRadicals(normalizeRoot(root)) === QUADRILITERAL_ROOT_RADICALS
      ? 4
      : 3;
  const { labels, rootError } = await describeVerbRoot(root, radicalCount);

  if (!labels) {
    return NextResponse.json({ classification: null, rootError, pattern: null } satisfies VerbFormResolutionResponse);
  }

  const pattern = formChoice ? await resolveVerbMorphPattern(root, formChoice) : null;

  return NextResponse.json({
    classification: labels,
    rootError: null,
    pattern: pattern ? { id: pattern.id, description: pattern.description } : null,
  } satisfies VerbFormResolutionResponse);
}
