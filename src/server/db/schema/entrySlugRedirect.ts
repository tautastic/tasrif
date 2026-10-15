import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { lexicalEntry } from "~/server/db/schema/lexicalEntry";

export const entrySlugRedirect = pgTable(
  "entry_slug_redirect",
  {
    oldSlug: text("old_slug").primaryKey(),
    lexicalEntryId: integer("lexical_entry_id")
      .notNull()
      .references(() => lexicalEntry.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_entry_slug_redirect_entry").on(table.lexicalEntryId)],
);

export type EntrySlugRedirectSelect = InferSelectModel<typeof entrySlugRedirect>;
export type EntrySlugRedirectInsert = InferInsertModel<typeof entrySlugRedirect>;
