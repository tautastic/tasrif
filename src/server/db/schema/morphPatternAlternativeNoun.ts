import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { morphPattern } from "~/server/db/schema/morphPattern";

export const ALTERNATIVE_NOUN_KINDS = ["masdar", "active_participle", "passive_participle"] as const;

export const alternativeNounKindEnum = pgEnum("alternative_noun_kind", ALTERNATIVE_NOUN_KINDS);

export type AlternativeNounKind = (typeof ALTERNATIVE_NOUN_KINDS)[number];

export const morphPatternAlternativeNoun = pgTable(
  "morph_pattern_alternative_noun",
  {
    id: serial("id").primaryKey(),
    morphPatternId: integer("morph_pattern_id").notNull(),
    root: varchar("root", { length: 10 }),
    noun: alternativeNounKindEnum("noun").notNull(),
    ordinal: smallint("ordinal").notNull().default(1),
    template: text("template").notNull(),
    verbatim: boolean("verbatim").notNull().default(false),
    note: text("note"),
  },
  (table) => [
    foreignKey({
      name: "fk_morph_pattern_alternative_noun_pattern",
      columns: [table.morphPatternId],
      foreignColumns: [morphPattern.id],
    }).onDelete("cascade"),
    unique("unique_morph_pattern_alternative_noun_key")
      .on(table.morphPatternId, table.root, table.noun, table.ordinal)
      .nullsNotDistinct(),
    index("idx_morph_pattern_alternative_noun_pattern").on(table.morphPatternId),
    check("chk_morph_pattern_alternative_noun_ordinal", sql`${table.ordinal} > 0`),
    check("chk_morph_pattern_alternative_noun_template", sql`btrim(${table.template}) <> ''`),
  ],
);

export type MorphPatternAlternativeNounSelect = InferSelectModel<typeof morphPatternAlternativeNoun>;
export type MorphPatternAlternativeNounInsert = InferInsertModel<typeof morphPatternAlternativeNoun>;
