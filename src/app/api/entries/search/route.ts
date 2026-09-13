import { NextResponse } from "next/server";
import { z } from "zod";
import { ENTRY_SEARCH_DEFAULT_LIMIT, ENTRY_SEARCH_MAX_LIMIT, type EntrySearchResponse } from "~/lib/api/entry-search";
import { searchLexicalEntries } from "~/server/db/repository/lexical-entry";

const searchQuerySchema = z.object({
  query: z.string().trim().default(""),
  limit: z.coerce.number().int().positive().max(ENTRY_SEARCH_MAX_LIMIT).catch(ENTRY_SEARCH_DEFAULT_LIMIT),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = searchQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!params.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const { query, limit } = params.data;
  if (!query) {
    return NextResponse.json({ items: [] } satisfies EntrySearchResponse);
  }

  const entries = await searchLexicalEntries(query, limit);
  const items = entries.map((entry) => ({
    id: entry.id,
    text: entry.text,
    normalizedText: entry.normalizedText,
    language: entry.language,
    root: entry.root,
  }));

  return NextResponse.json({ items } satisfies EntrySearchResponse);
}
