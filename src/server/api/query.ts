import { NextResponse } from "next/server";
import type { z } from "zod";
import { containsNul } from "~/lib/validation/nul";

export const parseQuery = <S extends z.ZodType>(
  schema: S,
  searchParams: URLSearchParams,
): { data: z.output<S>; response?: undefined } | { data?: undefined; response: NextResponse } => {
  const values = Object.fromEntries(searchParams);
  if (containsNul(values)) {
    return { response: NextResponse.json({ error: "Invalid parameters" }, { status: 400 }) };
  }
  const result = schema.safeParse(values);
  if (!result.success) {
    return { response: NextResponse.json({ error: "Invalid parameters" }, { status: 400 }) };
  }
  return { data: result.data };
};
