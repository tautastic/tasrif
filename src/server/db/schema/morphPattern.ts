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
import type { MorphPatternRules } from "~/lib/validation/morphPatternRules";
import { derivedByInsertTrigger } from "~/server/db/schema/derivedByTrigger";

export const radicalKindEnum = pgEnum("radical_kind", ["sound", "waw", "ya", "hamza"]);
export type RadicalKind = (typeof radicalKindEnum.enumValues)[number];

export const shortVowelEnum = pgEnum("short_vowel", ["a", "i", "u"]);
export type ShortVowel = (typeof shortVowelEnum.enumValues)[number];

export const morphPattern = pgTable(
  "morph_pattern",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().$defaultFn(derivedByInsertTrigger),
    formNumber: smallint("form_number").notNull(),
    radicalCount: smallint("radical_count").notNull().default(3),
    vocalicTemplate: varchar("vocalic_template", { length: 255 }).notNull(),
    description: text("description").notNull(),
    rules: jsonb("rules").$type<MorphPatternRules>().notNull(),
    noAffix: boolean("no_affix").notNull().default(false),
    isLexical: boolean("is_lexical").notNull().default(false),
    radical1Kind: radicalKindEnum("radical1_kind").notNull().default("sound"),
    radical2Kind: radicalKindEnum("radical2_kind").notNull().default("sound"),
    radical3Kind: radicalKindEnum("radical3_kind").notNull().default("sound"),
    radical4Kind: radicalKindEnum("radical4_kind").notNull().default("sound"),
    isGeminate: boolean("is_geminate").notNull().default(false),
    perfectVowel: shortVowelEnum("perfect_vowel"),
    imperfectVowel: shortVowelEnum("imperfect_vowel"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_description").on(table.description),
    unique("unique_form_number_description").on(table.formNumber, table.radicalCount, table.description),
    unique("unique_morph_pattern_code").on(table.code),
    check("chk_morph_pattern_radical_count", sql`${table.radicalCount} IN (3, 4)`),
    check(
      "chk_morph_pattern_radical_count_rules",
      sql`(${table.radicalCount} = 4) = (position('{4}' in ${table.rules}::text) > 0)`,
    ),
    check(
      "chk_morph_pattern_quadriliteral_shape",
      sql`${table.radicalCount} = 3 OR (${table.radical1Kind} = 'sound' AND ${table.radical2Kind} = 'sound' AND ${table.radical3Kind} = 'sound' AND NOT ${table.isGeminate})`,
    ),
    check(
      "chk_morph_pattern_radical4_kind",
      sql`${table.radical4Kind} IN ('sound', 'waw', 'ya') AND (${table.radicalCount} = 4 OR ${table.radical4Kind} = 'sound')`,
    ),
    check("chk_morph_pattern_code", sql`${table.code} ~ '^f[0-9]+(-[a-z]+)*$'`),
    check(
      "chk_morph_pattern_form1_vowels",
      sql`(${table.formNumber} = 1) = (${table.perfectVowel} IS NOT NULL AND ${table.imperfectVowel} IS NOT NULL)`,
    ),
  ],
);

export type MorphPatternSelect = InferSelectModel<typeof morphPattern>;
export type MorphPatternInsert = InferInsertModel<typeof morphPattern>;
