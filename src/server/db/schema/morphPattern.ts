import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const morphPattern = pgTable(
  "morph_pattern",
  {
    id: serial("id").primaryKey(),
    formNumber: smallint("form_number").notNull(),
    vocalicTemplate: varchar("vocalic_template", { length: 255 }).notNull(),
    description: text("description").notNull(),
    rules: jsonb("rules").notNull(),
    noAffix: boolean("no_affix").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_form_number").on(table.formNumber),
    index("idx_description").on(table.description),
    unique("unique_form_number_description").on(table.formNumber, table.description),
  ],
);

export type MorphPatternSelect = InferSelectModel<typeof morphPattern>;
export type MorphPatternInsert = InferInsertModel<typeof morphPattern>;
