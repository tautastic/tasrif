import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { check, integer, pgEnum, pgTable, serial, smallint, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sense } from "~/server/db/schema/sense";

export const senseRelations = ["synonym", "antonym", "hyponym", "hypernym", "near_synonym"] as const;

export const senseRelationTypeEnum = pgEnum("sense_relation_type", senseRelations);
export type SenseRelationType = (typeof senseRelationTypeEnum.enumValues)[number];

export const senseRelation = pgTable(
  "sense_relation",
  {
    id: serial("id").primaryKey(),
    senseId1: integer("sense_id_1")
      .notNull()
      .references(() => sense.id, { onDelete: "cascade" }),
    senseId2: integer("sense_id_2")
      .notNull()
      .references(() => sense.id, { onDelete: "cascade" }),
    relationType: senseRelationTypeEnum("relation_type").notNull(),
    strength: smallint("strength").default(5),
    contextNote: text("context_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("unique_relation").on(table.senseId1, table.senseId2, table.relationType),
    check("sense_different", sql`sense_id_1 != sense_id_2`),
  ],
);

export type SenseRelationSelect = InferSelectModel<typeof senseRelation>;
export type SenseRelationInsert = InferInsertModel<typeof senseRelation>;
