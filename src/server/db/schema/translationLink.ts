import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, pgTable, serial, smallint, text, unique, varchar } from "drizzle-orm/pg-core";
import { sense } from "~/server/db/schema/sense";

export const translationLink = pgTable(
  "translation_link",
  {
    id: serial("id").primaryKey(),
    enSenseId: integer("en_sense_id")
      .notNull()
      .references(() => sense.id, { onDelete: "cascade" }),
    arSenseId: integer("ar_sense_id")
      .notNull()
      .references(() => sense.id, { onDelete: "cascade" }),
    frequencyRank: smallint("frequency_rank").default(5),
    domain: varchar("domain", { length: 50 }),
    note: text("note"),
  },
  (table) => [
    unique("unique_translation").on(table.enSenseId, table.arSenseId),
    index("idx_translation_link_ar_sense_id").on(table.arSenseId),
  ],
);

export type TranslationLinkSelect = InferSelectModel<typeof translationLink>;
export type TranslationLinkInsert = InferInsertModel<typeof translationLink>;
