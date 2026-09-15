import { NextResponse } from "next/server";
import { z } from "zod";
import type { VerbFormResolutionResponse } from "~/lib/api/verb-form";
import { verbFormChoiceSchema } from "~/lib/validation/verbFormChoice";
import { isAuthenticated } from "~/server/auth";
import { describeVerbRoot, resolveVerbMorphPattern } from "~/server/db/repository/morph-pattern";

const querySchema = z.object({
  root: z.string().trim().min(1),
  formChoice: verbFormChoiceSchema.optional(),
});

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const params = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!params.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { root, formChoice } = params.data;
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
