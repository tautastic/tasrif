import { asc } from "drizzle-orm";
import { db } from "~/server/db";

export const getAllMorphPatterns = () => {
  return db.query.morphPattern.findMany({
    orderBy: (pattern) => [asc(pattern.formNumber), asc(pattern.description), asc(pattern.id)],
  });
};
