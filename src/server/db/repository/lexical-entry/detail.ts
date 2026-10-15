import type { AlternativeFormsByCell, AlternativeNounsByKind } from "~/lib/alternative-forms";
import { db } from "~/server/db";
import { morphPattern } from "~/server/db/schema";
import { type EntryAlternatives, getEntryAlternatives } from "./alternatives";
import { countEntriesWithRoot, entryMorphPatternSummaryColumns, senseWithTranslationsAndRelations } from "./shared";

const withAlternatives = (
  alternatives: EntryAlternatives | undefined,
): {
  alternatives?: AlternativeFormsByCell;
  passiveAlternatives?: AlternativeFormsByCell;
  alternativeNouns?: AlternativeNounsByKind;
} => ({
  ...(alternatives?.forms ? { alternatives: alternatives.forms } : {}),
  ...(alternatives?.passiveForms ? { passiveAlternatives: alternatives.passiveForms } : {}),
  ...(alternatives?.nouns ? { alternativeNouns: alternatives.nouns } : {}),
});

export const getLexicalEntryBySlug = async (slug: string) => {
  const entries = await db.query.lexicalEntry.findMany({
    where: { slug, isVerified: true },
    columns: { searchVector: false },
    with: {
      morphPattern: { columns: entryMorphPatternSummaryColumns },
      senses: {
        with: senseWithTranslationsAndRelations,
        orderBy: (senses, { asc }) => [asc(senses.senseNumber)],
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

  const [rootCount, alternatives] = await Promise.all([
    countEntriesWithRoot(first.root),
    getEntryAlternatives(entries.filter((entry) => entry.morphPatternId !== null).map((entry) => entry.id)),
  ]);

  return {
    slug: first.slug,
    language: first.language,
    rootInfo: {
      arabic: first.root,
      latin: first.latinRoot,
      count: rootCount,
    },
    entries: entries.map((entry) => ({ ...entry, ...withAlternatives(alternatives.get(entry.id)) })),
  };
};

export type EntryPageData = NonNullable<Awaited<ReturnType<typeof getLexicalEntryBySlug>>>;
type EntryPageRow = EntryPageData["entries"][number];
export type EntryPageEntry = Omit<EntryPageRow, "morphPattern"> & {
  morphPattern: { formNumber: number; radicalCount?: number; description: string } | null;
};
export type EntryPageSense = EntryPageEntry["senses"][number];
export type EntryRootInfo = EntryPageData["rootInfo"];
