import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, pgTable, serial, text, unique } from "drizzle-orm/pg-core";
import { affixMoodEnum } from "./affixRules";
import { lexicalEntry } from "./lexicalEntry";

export const conjugation = pgTable(
  "conjugation",
  {
    id: serial("id").primaryKey(),
    lexicalEntryId: integer("lexical_entry_id")
      .notNull()
      .references(() => lexicalEntry.id, { onDelete: "cascade" }),
    mood: affixMoodEnum("mood").notNull(),
    firstPersonSingular: text("first_person_singular"),
    secondPersonMasculineSingular: text("second_person_masculine_singular"),
    secondPersonFeminineSingular: text("second_person_feminine_singular"),
    thirdPersonMasculineSingular: text("third_person_masculine_singular"),
    thirdPersonFeminineSingular: text("third_person_feminine_singular"),
    secondPersonDual: text("second_person_dual"),
    thirdPersonMasculineDual: text("third_person_masculine_dual"),
    thirdPersonFeminineDual: text("third_person_feminine_dual"),
    firstPersonPlural: text("first_person_plural"),
    secondPersonMasculinePlural: text("second_person_masculine_plural"),
    secondPersonFemininePlural: text("second_person_feminine_plural"),
    thirdPersonMasculinePlural: text("third_person_masculine_plural"),
    thirdPersonFemininePlural: text("third_person_feminine_plural"),
  },
  (table) => [
    index("idx_conjugation_entry").on(table.lexicalEntryId),
    index("idx_conjugation_mood").on(table.mood),
    unique("unique_conjugation_entry_mood").on(table.lexicalEntryId, table.mood),
  ],
);

export type ConjugationSelect = InferSelectModel<typeof conjugation>;
export type ConjugationInsert = InferInsertModel<typeof conjugation>;
