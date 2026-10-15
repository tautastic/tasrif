import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, serial, smallint, timestamp, unique } from "drizzle-orm/pg-core";
import { morphPattern, radicalKindEnum, shortVowelEnum } from "~/server/db/schema/morphPattern";

const copiedFromPatternByTrigger = () => sql`NULL`;

export const morphPatternResolution = pgTable(
  "morph_pattern_resolution",
  {
    id: serial("id").primaryKey(),
    morphPatternId: integer("morph_pattern_id")
      .notNull()
      .references(() => morphPattern.id, { onDelete: "cascade" }),
    formNumber: smallint("form_number").notNull().$defaultFn(copiedFromPatternByTrigger),
    radicalCount: smallint("radical_count").notNull().default(3),
    perfectVowel: shortVowelEnum("perfect_vowel"),
    imperfectVowel: shortVowelEnum("imperfect_vowel"),
    radical1Kind: radicalKindEnum("radical1_kind").notNull(),
    radical2Kind: radicalKindEnum("radical2_kind").notNull(),
    radical3Kind: radicalKindEnum("radical3_kind").notNull(),
    radical4Kind: radicalKindEnum("radical4_kind").notNull().default("sound"),
    isGeminate: boolean("is_geminate").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("unique_morph_pattern_resolution_key")
      .on(
        table.formNumber,
        table.radicalCount,
        table.perfectVowel,
        table.imperfectVowel,
        table.radical1Kind,
        table.radical2Kind,
        table.radical3Kind,
        table.radical4Kind,
        table.isGeminate,
      )
      .nullsNotDistinct(),
    index("idx_morph_pattern_resolution_pattern").on(table.morphPatternId),
    check(
      "chk_morph_pattern_resolution_form1_vowels",
      sql`(${table.formNumber} = 1) = (${table.perfectVowel} IS NOT NULL AND ${table.imperfectVowel} IS NOT NULL)`,
    ),
  ],
);

export type MorphPatternResolutionSelect = InferSelectModel<typeof morphPatternResolution>;
export type MorphPatternResolutionInsert = InferInsertModel<typeof morphPatternResolution>;
