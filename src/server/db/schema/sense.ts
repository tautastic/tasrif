import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, serial, smallint, text, unique } from "drizzle-orm/pg-core";
import { lexicalEntry } from "./lexicalEntry";

export const posTypes = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "interjection",
  "pronoun",
  "determiner",
  "particle",
  "adverbial_phrase",
  "idiom",
] as const;

export const posTypeEnum = pgEnum("pos_type", posTypes);
export type PartOfSpeechType = (typeof posTypeEnum.enumValues)[number];

export const sense = pgTable(
  "sense",
  {
    id: serial("id").primaryKey(),
    lexicalEntryId: integer("lexical_entry_id")
      .notNull()
      .references(() => lexicalEntry.id, { onDelete: "cascade" }),
    pos: posTypeEnum("pos").notNull(),
    senseNumber: smallint("sense_number").notNull(),
    definitions: text("definitions").array().notNull().default([]),
    contextTags: text("context_tags").array().notNull().default(sql`'{}'`),
    examples: text("examples").array().notNull().default([]),
  },
  (table) => [
    index("idx_sense_definitions").using("gin", table.definitions),
    index("idx_sense_context_tags").using("gin", table.contextTags),
    unique("unique_sense_number").on(table.lexicalEntryId, table.senseNumber),
  ],
);

export type SenseSelect = InferSelectModel<typeof sense>;
export type SenseInsert = InferInsertModel<typeof sense>;
