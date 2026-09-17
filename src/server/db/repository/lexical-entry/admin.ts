import { asc, desc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { lexicalEntry } from "~/server/db/schema";
import { countEntriesWithRoot, entryMorphPatternSummaryColumns, senseWithTranslationsAndRelations } from "./shared";

export const AdminEntryFilterOptions = ["All", "Verified", "Unverified"] as const;
export type AdminEntryFilterValue = (typeof AdminEntryFilterOptions)[number];

export const getLexicalEntriesForAdmin = async ({
  filter,
  page,
  limit,
}: {
  filter: AdminEntryFilterValue;
  page: number;
  limit: number;
}) => {
  const [items, total] = await Promise.all([
    db.query.lexicalEntry.findMany({
      where: filter === "All" ? undefined : { isVerified: filter === "Verified" },
      columns: { id: true, text: true, normalizedText: true, language: true, isVerified: true, root: true },
      with: {
        morphPattern: { columns: { formNumber: true } },
        senses: {
          columns: { pos: true },
          orderBy: (senses, { asc }) => [asc(senses.senseNumber)],
        },
      },
      orderBy: (entry) => [desc(entry.createdAt), asc(entry.id)],
      limit,
      offset: (page - 1) * limit,
    }),
    filter === "All"
      ? db.$count(lexicalEntry)
      : db.$count(lexicalEntry, eq(lexicalEntry.isVerified, filter === "Verified")),
  ]);

  return { items, total };
};

export const getLexicalEntryByIdForAdmin = async (id: number) => {
  const entry = await db.query.lexicalEntry.findFirst({
    where: { id },
    columns: { searchVector: false },
    with: {
      morphPattern: { columns: entryMorphPatternSummaryColumns },
      senses: {
        with: senseWithTranslationsAndRelations,
        orderBy: (senses, { asc }) => [asc(senses.senseNumber)],
      },
      conjugations: true,
    },
  });

  if (!entry) {
    return null;
  }

  return {
    language: entry.language,
    rootInfo: {
      arabic: entry.root,
      latin: entry.latinRoot,
      count: await countEntriesWithRoot(entry.root),
    },
    entry,
  };
};
