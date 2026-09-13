import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import type { MorphologyOverrides } from "~/lib/validation/morphology";
import { morphPattern } from "~/server/db/schema/morphPattern";

const tsVector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const languageOptions = ["ar", "en"] as const;
export const langTypeEnum = pgEnum("lang_type", languageOptions);
export type LanguageType = (typeof langTypeEnum.enumValues)[number];

export const isLanguageType = (value: unknown): value is LanguageType =>
  languageOptions.includes(value as LanguageType);

export const lexicalEntry = pgTable(
  "lexical_entry",
  {
    id: serial("id").primaryKey(),
    language: langTypeEnum("language").notNull(),
    text: varchar("text", { length: 255 }).notNull(),
    normalizedText: text("normalized_text")
      .generatedAlwaysAs(
        sql`LOWER(REGEXP_REPLACE(text, '[[:punct:][:space:]\u064B-\u065F\u0670\u0610-\u061A]', '', 'g'))`,
      )
      .notNull(),
    root: varchar("root", { length: 10 }),
    latinRoot: varchar("latin_root", { length: 20 }),
    morphPatternId: integer("morph_pattern_id").references(() => morphPattern.id, { onDelete: "set null" }),
    morphologyOverrides: jsonb("morphology_overrides").$type<MorphologyOverrides>(),
    masdar: text("masdar"),
    activeParticiple: text("active_participle"),
    passiveParticiple: text("passive_participle"),
    searchVector: tsVector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("unique_language_text").on(table.language, table.text),
    index("idx_lexical_entry_root").on(table.root),
    index("idx_lexical_entry_latin_root").on(table.latinRoot),
    index("idx_lexical_entry_pattern").on(table.morphPatternId),
    index("idx_lexical_entry_text_trgm").using("gin", sql`${table.text} gin_trgm_ops`),
    index("idx_lexical_entry_search_vector").using("gin", table.searchVector),
    index("idx_lexical_entry_language_created_at").on(table.language, sql`${table.createdAt} DESC`),
  ],
);

export type LexicalEntrySelect = Omit<InferSelectModel<typeof lexicalEntry>, "searchVector">;
export type LexicalEntryInsert = InferInsertModel<typeof lexicalEntry>;
