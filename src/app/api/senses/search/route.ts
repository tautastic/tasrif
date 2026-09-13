import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SENSE_SEARCH_DEFAULT_LIMIT,
  SENSE_SEARCH_MAX_LIMIT,
  SENSE_SEARCH_MIN_QUERY_LENGTH,
  type SenseSearchResponse,
} from "~/lib/api/sense-search";
import { getSensesByIds, searchSenses } from "~/server/db/repository/sense";
import { languageOptions } from "~/server/db/schema";

const parseIdList = (value: string): number[] => {
  const ids = value
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
};

const searchQuerySchema = z.object({
  query: z.string().trim().default(""),
  language: z.enum(languageOptions).optional(),
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().positive().max(SENSE_SEARCH_MAX_LIMIT).catch(SENSE_SEARCH_DEFAULT_LIMIT),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const idsParam = searchParams.get("ids");
  if (idsParam !== null) {
    const items = await getSensesByIds(parseIdList(idsParam));
    return NextResponse.json({ items, hasMore: false } satisfies SenseSearchResponse);
  }

  const params = searchQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!params.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const { query, language, page, limit } = params.data;
  if (query.length < SENSE_SEARCH_MIN_QUERY_LENGTH) {
    return NextResponse.json({ items: [], hasMore: false } satisfies SenseSearchResponse);
  }

  return NextResponse.json((await searchSenses({ query, language, page, limit })) satisfies SenseSearchResponse);
}
