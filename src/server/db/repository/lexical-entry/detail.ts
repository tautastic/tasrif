import { db } from "~/server/db";
import { morphPattern } from "~/server/db/schema";
import { countEntriesWithRoot } from "./shared";

export const getLexicalEntryByNormalizedText = async (normalizedText: string) => {
  const entries = await db.query.lexicalEntry.findMany({
    where: { normalizedText, isVerified: true },
    columns: { searchVector: false },
    with: {
      morphPattern: {
        columns: { formNumber: true, description: true },
      },
      senses: {
        with: { translations: true, relatedSenses: true },
        orderBy: (senses, { sql }) => [sql`${senses.senseNumber}`],
      },
      conjugations: true,
    },
    orderBy: (lexicalEntry, { sql }) => [
      sql`case when ${lexicalEntry.morphPatternId} is null then 1 else 0 end`,
      sql`coalesce(
        (select ${morphPattern.formNumber}
      from ${morphPattern}
      where ${morphPattern.id} = ${lexicalEntry.morphPatternId}),
      ${lexicalEntry.id}
      )`,
      sql`${lexicalEntry.id}`,
    ],
  });

  const first = entries[0];
  if (!first) {
    return null;
  }

  return {
    language: first.language,
    rootInfo: {
      arabic: first.root,
      latin: first.latinRoot,
      count: await countEntriesWithRoot(first.root),
    },
    entries,
  };
};

export type EntryPageData = NonNullable<Awaited<ReturnType<typeof getLexicalEntryByNormalizedText>>>;
export type EntryPageEntry = EntryPageData["entries"][number];
export type EntryPageSense = EntryPageEntry["senses"][number];
export type EntryRootInfo = EntryPageData["rootInfo"];
