import { NextResponse } from "next/server";
import { z } from "zod";
import type { VerbFormResolutionResponse } from "~/lib/api/verb-form";
import { verbFormChoiceSchema } from "~/lib/validation/verbFormChoice";
import { parseQuery } from "~/server/api/query";
import { requireAdminApi } from "~/server/auth/guard";
import { describeVerbRoot, resolveVerbMorphPattern } from "~/server/db/repository/morph-pattern";

const querySchema = z.object({
  root: z.string().trim().min(1),
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
  const { labels, rootError } = await describeVerbRoot(root);

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
