import { asc, desc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { lexicalEntry } from "~/server/db/schema";
import { countEntriesWithRoot } from "./shared";

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
      columns: { id: true, text: true, normalizedText: true, language: true, isVerified: true },
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
      morphPattern: {
        columns: { formNumber: true, description: true },
      },
      senses: {
        with: { translations: true, relatedSenses: true },
        orderBy: (senses, { sql }) => [sql`${senses.senseNumber}`],
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
