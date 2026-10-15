import { NextResponse } from "next/server";
import { z } from "zod";
import { ENTRY_SEARCH_DEFAULT_LIMIT, ENTRY_SEARCH_MAX_LIMIT, type EntrySearchResponse } from "~/lib/api/entry-search";
import { parseQuery } from "~/server/api/query";
import { searchLexicalEntries } from "~/server/db/repository/lexical-entry";

const ENTRY_SEARCH_MAX_QUERY_LENGTH = 100;

const searchQuerySchema = z.object({
  query: z.string().trim().max(ENTRY_SEARCH_MAX_QUERY_LENGTH).default(""),
  limit: z.coerce.number().int().positive().max(ENTRY_SEARCH_MAX_LIMIT).catch(ENTRY_SEARCH_DEFAULT_LIMIT),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(searchQuerySchema, searchParams);
  if (parsed.response) {
    return parsed.response;
  }

  const { query, limit } = parsed.data;
  if (!query) {
    return NextResponse.json({ items: [] } satisfies EntrySearchResponse);
  }

  const entries = await searchLexicalEntries(query, limit);
  const items = entries.map((entry) => ({
    id: entry.id,
    text: entry.text,
    slug: entry.slug,
    normalizedText: entry.normalizedText,
    language: entry.language,
    root: entry.root,
  }));

  return NextResponse.json({ items } satisfies EntrySearchResponse);
}
