import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, serial, text, unique } from "drizzle-orm/pg-core";
import { affixMoodEnum, personTypeEnum } from "./affixRules";
import { lexicalEntry } from "./lexicalEntry";

export const voiceTypeEnum = pgEnum("voice_type", ["active", "passive"]);
export type VoiceType = (typeof voiceTypeEnum.enumValues)[number];

export const conjugation = pgTable(
  "conjugation",
  {
    id: serial("id").primaryKey(),
    lexicalEntryId: integer("lexical_entry_id")
      .notNull()
      .references(() => lexicalEntry.id, { onDelete: "cascade" }),
    voice: voiceTypeEnum("voice").notNull().default("active"),
    mood: affixMoodEnum("mood").notNull(),
    person: personTypeEnum("person").notNull(),
    form: text("form").notNull(),
  },
  (table) => [
    index("idx_conjugation_entry").on(table.lexicalEntryId),
    index("idx_conjugation_mood").on(table.mood),
    unique("unique_conjugation_entry_voice_mood_person").on(
      table.lexicalEntryId,
      table.voice,
      table.mood,
      table.person,
    ),
  ],
);

export type ConjugationSelect = InferSelectModel<typeof conjugation>;
export type ConjugationInsert = InferInsertModel<typeof conjugation>;
