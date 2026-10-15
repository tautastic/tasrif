import { sql } from "drizzle-orm";
import { db } from "~/server/db";

export const findEntryRedirectSlug = async (key: string): Promise<string | null> => {
  const result = await db.execute<{ slug: string | null }>(sql`SELECT resolve_entry_slug_redirect(${key}) AS slug`);
  return result.rows[0]?.slug ?? null;
};
