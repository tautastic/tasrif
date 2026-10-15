import { NextResponse } from "next/server";
import { z } from "zod";
import type { PatternVariantsResponse } from "~/lib/api/pattern-variants";
import { idSchema } from "~/lib/validation/ids";
import { verbFormChoiceSchema } from "~/lib/validation/verbFormChoice";
import { parseQuery } from "~/server/api/query";
import { requireAdminApi } from "~/server/auth/guard";
import { getPgErrorWithCode, INVALID_ROOT_SQLSTATE } from "~/server/db/pg-error";
import { getEntryMorphPatternId, listMorphPatternVariants } from "~/server/db/repository/morph-pattern";

const MAX_ROOT_LENGTH = 100;

const querySchema = z.object({
  root: z.string().trim().min(1).max(MAX_ROOT_LENGTH),
  formChoice: verbFormChoiceSchema,
  entryId: z.coerce.number().pipe(idSchema).optional(),
});

const EMPTY_RESPONSE: PatternVariantsResponse = { variants: [], current: null };

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = parseQuery(querySchema, new URL(request.url).searchParams);
  if (parsed.response) {
    return parsed.response;
  }

  const { root, formChoice, entryId } = parsed.data;
  try {
    const rows = await listMorphPatternVariants(root, formChoice);
    const storedId = entryId === undefined ? null : await getEntryMorphPatternId(entryId);
    const current = storedId !== null && rows.some((row) => row.id === storedId) ? storedId : null;
    return NextResponse.json({
      variants: rows.map((row) => ({
        id: row.id,
        variant: row.variant,
        description: row.description,
        note: row.note,
        sample: row.sample,
        isDefault: row.isDefault,
      })),
      current,
    } satisfies PatternVariantsResponse);
  } catch (error) {
    if (getPgErrorWithCode(error, INVALID_ROOT_SQLSTATE)) {
      return NextResponse.json(EMPTY_RESPONSE satisfies PatternVariantsResponse);
    }
    throw error;
  }
}
