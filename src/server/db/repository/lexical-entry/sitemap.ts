import { asc, countDistinct, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { lexicalEntry } from "~/server/db/schema";

export const countSitemapEntrySlugs = async (): Promise<number> => {
  const [result] = await db
    .select({ count: countDistinct(lexicalEntry.slug) })
    .from(lexicalEntry)
    .where(eq(lexicalEntry.isVerified, true));
  return result?.count ?? 0;
};

export const getSitemapEntrySlugs = async ({ offset, limit }: { offset: number; limit: number }): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ slug: lexicalEntry.slug })
    .from(lexicalEntry)
    .where(eq(lexicalEntry.isVerified, true))
    .orderBy(asc(lexicalEntry.slug))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => row.slug);
};
