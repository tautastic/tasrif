import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { morphPattern, shortVowelEnum } from "~/server/db/schema/morphPattern";

export const lexicalPatternOverride = pgTable(
  "lexical_pattern_override",
  {
    id: serial("id").primaryKey(),
    root: varchar("root", { length: 10 }).notNull(),
    formNumber: smallint("form_number").notNull(),
    perfectVowel: shortVowelEnum("perfect_vowel"),
    imperfectVowel: shortVowelEnum("imperfect_vowel"),
    morphPatternId: integer("morph_pattern_id")
      .notNull()
      .references(() => morphPattern.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("unique_lexical_pattern_override_key")
      .on(table.root, table.formNumber, table.perfectVowel, table.imperfectVowel)
      .nullsNotDistinct(),
    index("idx_lexical_pattern_override_pattern").on(table.morphPatternId),
    check(
      "chk_lexical_pattern_override_form1_vowels",
      sql`(${table.formNumber} = 1) = (${table.perfectVowel} IS NOT NULL AND ${table.imperfectVowel} IS NOT NULL)`,
    ),
  ],
);

export type LexicalPatternOverrideSelect = InferSelectModel<typeof lexicalPatternOverride>;
export type LexicalPatternOverrideInsert = InferInsertModel<typeof lexicalPatternOverride>;
