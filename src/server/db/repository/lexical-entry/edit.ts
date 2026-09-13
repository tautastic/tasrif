import { asc } from "drizzle-orm";
import { db } from "~/server/db";

export const getLexicalEntryForEdit = (id: number) => {
  return db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { searchVector: false },
    with: {
      senses: {
        with: { translations: true, relatedSenses: true },
        orderBy: (sense) => [asc(sense.senseNumber)],
      },
    },
  });
};

export const getLexicalEntrySummary = (id: number) => {
  return db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { text: true, language: true },
  });
};
