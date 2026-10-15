import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { affixMoodEnum, personTypeEnum } from "~/server/db/schema/affixRules";
import { voiceTypeEnum } from "~/server/db/schema/conjugation";
import { morphPattern } from "~/server/db/schema/morphPattern";

export const morphPatternAlternative = pgTable(
  "morph_pattern_alternative",
  {
    id: serial("id").primaryKey(),
    morphPatternId: integer("morph_pattern_id").notNull(),
    root: varchar("root", { length: 10 }),
    voice: voiceTypeEnum("voice").notNull().default("active"),
    mood: affixMoodEnum("mood").notNull(),
    person: personTypeEnum("person").notNull(),
    ordinal: smallint("ordinal").notNull().default(1),
    template: text("template").notNull(),
    verbatim: boolean("verbatim").notNull().default(false),
    note: text("note"),
  },
  (table) => [
    foreignKey({
      name: "fk_morph_pattern_alternative_pattern",
      columns: [table.morphPatternId],
      foreignColumns: [morphPattern.id],
    }).onDelete("cascade"),
    unique("unique_morph_pattern_alternative_key")
      .on(table.morphPatternId, table.root, table.voice, table.mood, table.person, table.ordinal)
      .nullsNotDistinct(),
    index("idx_morph_pattern_alternative_pattern").on(table.morphPatternId),
    check("chk_morph_pattern_alternative_ordinal", sql`${table.ordinal} > 0`),
    check("chk_morph_pattern_alternative_template", sql`btrim(${table.template}) <> ''`),
  ],
);

export type MorphPatternAlternativeSelect = InferSelectModel<typeof morphPatternAlternative>;
export type MorphPatternAlternativeInsert = InferInsertModel<typeof morphPatternAlternative>;
