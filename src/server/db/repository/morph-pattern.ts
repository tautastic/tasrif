import { asc, count, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { lexicalEntry, morphPattern } from "~/server/db/schema";

export const getAllMorphPatterns = () => {
  return db.query.morphPattern.findMany({
    orderBy: (pattern) => [asc(pattern.formNumber), asc(pattern.description), asc(pattern.id)],
  });
};

export const getVerbFormsWithCounts = async () => {
  const rows = await db
    .select({
      formNumber: morphPattern.formNumber,
      total: count(lexicalEntry.id),
    })
    .from(morphPattern)
    .leftJoin(lexicalEntry, eq(lexicalEntry.morphPatternId, morphPattern.id))
    .groupBy(morphPattern.formNumber)
    .orderBy(asc(morphPattern.formNumber));

  return rows.filter((row) => row.total > 0);
};
