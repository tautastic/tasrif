import { NextResponse } from "next/server";
import type { z } from "zod";

export const parseQuery = <S extends z.ZodType>(
  schema: S,
  searchParams: URLSearchParams,
): { data: z.output<S>; response?: undefined } | { data?: undefined; response: NextResponse } => {
  const result = schema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) {
    return { response: NextResponse.json({ error: "Invalid parameters" }, { status: 400 }) };
  }
  return { data: result.data };
};
