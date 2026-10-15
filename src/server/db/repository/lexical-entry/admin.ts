import { asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { conjugation, lexicalEntry } from "~/server/db/schema";
import { countEntriesWithRoot, entryMorphPatternSummaryColumns, senseWithTranslationsAndRelations } from "./shared";

export const AdminEntryFilterOptions = ["All", "Verified", "Unverified", "Needs attention"] as const;
export type AdminEntryFilterValue = (typeof AdminEntryFilterOptions)[number];

type EntryColumns = Pick<
  typeof lexicalEntry,
  "id" | "morphPatternId" | "masdar" | "activeParticiple" | "passiveParticiple"
>;

const needsAttentionCondition = (entry: EntryColumns): SQL => sql`(
  ${entry.morphPatternId} IS NOT NULL
  AND ${entry.masdar} IS NULL
  AND ${entry.activeParticiple} IS NULL
  AND ${entry.passiveParticiple} IS NULL
  AND NOT EXISTS (SELECT 1 FROM ${conjugation} WHERE ${conjugation.lexicalEntryId} = ${entry.id})
)`;

export const getNeedsAttentionCount = () => db.$count(lexicalEntry, needsAttentionCondition(lexicalEntry));

const adminFilterWhere = (filter: AdminEntryFilterValue) => {
  switch (filter) {
    case "All":
      return undefined;
    case "Needs attention":
      return { RAW: needsAttentionCondition };
    default:
      return { isVerified: filter === "Verified" };
  }
};

const adminFilterCount = (filter: AdminEntryFilterValue) => {
  switch (filter) {
    case "All":
      return db.$count(lexicalEntry);
    case "Needs attention":
      return getNeedsAttentionCount();
    default:
      return db.$count(lexicalEntry, eq(lexicalEntry.isVerified, filter === "Verified"));
  }
};

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
      where: adminFilterWhere(filter),
      columns: { id: true, text: true, slug: true, language: true, isVerified: true, root: true },
      with: {
        morphPattern: { columns: { formNumber: true, radicalCount: true } },
        senses: {
          columns: { pos: true },
          orderBy: (senses, { asc }) => [asc(senses.senseNumber)],
        },
      },
      orderBy: (entry) => [desc(entry.createdAt), asc(entry.id)],
      limit,
      offset: (page - 1) * limit,
    }),
    adminFilterCount(filter),
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
