import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const radicalKindEnum = pgEnum("radical_kind", ["sound", "waw", "ya", "hamza"]);
export type RadicalKind = (typeof radicalKindEnum.enumValues)[number];

export const shortVowelEnum = pgEnum("short_vowel", ["a", "i", "u"]);
export type ShortVowel = (typeof shortVowelEnum.enumValues)[number];

export const morphPattern = pgTable(
  "morph_pattern",
  {
    id: serial("id").primaryKey(),
    formNumber: smallint("form_number").notNull(),
    vocalicTemplate: varchar("vocalic_template", { length: 255 }).notNull(),
    description: text("description").notNull(),
    rules: jsonb("rules").notNull(),
    noAffix: boolean("no_affix").notNull().default(false),
    isLexical: boolean("is_lexical").notNull().default(false),
    radical1Kind: radicalKindEnum("radical1_kind").notNull().default("sound"),
    radical2Kind: radicalKindEnum("radical2_kind").notNull().default("sound"),
    radical3Kind: radicalKindEnum("radical3_kind").notNull().default("sound"),
    isGeminate: boolean("is_geminate").notNull().default(false),
    perfectVowel: shortVowelEnum("perfect_vowel"),
    imperfectVowel: shortVowelEnum("imperfect_vowel"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_form_number").on(table.formNumber),
    index("idx_description").on(table.description),
    unique("unique_form_number_description").on(table.formNumber, table.description),
    check(
      "chk_morph_pattern_form1_vowels",
      sql`(${table.formNumber} = 1) = (${table.perfectVowel} IS NOT NULL AND ${table.imperfectVowel} IS NOT NULL)`,
    ),
  ],
);

export type MorphPatternSelect = InferSelectModel<typeof morphPattern>;
export type MorphPatternInsert = InferInsertModel<typeof morphPattern>;
