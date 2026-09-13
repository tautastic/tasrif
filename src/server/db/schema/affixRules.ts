import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, pgEnum, pgTable, serial, text, unique } from "drizzle-orm/pg-core";

export const personTypeEnum = pgEnum("person_type", [
  "first_person_singular",
  "second_person_masculine_singular",
  "second_person_feminine_singular",
  "third_person_masculine_singular",
  "third_person_feminine_singular",
  "second_person_dual",
  "third_person_masculine_dual",
  "third_person_feminine_dual",
  "first_person_plural",
  "second_person_masculine_plural",
  "second_person_feminine_plural",
  "third_person_masculine_plural",
  "third_person_feminine_plural",
]);
export type PersonType = (typeof personTypeEnum.enumValues)[number];
export type PersonForms = Record<PersonType, string>;

export const affixMoodEnum = pgEnum("affix_mood", [
  "perfect",
  "imperative",
  "imperfect_indicative",
  "imperfect_subjunctive",
  "imperfect_jussive",
]);
export type AffixMoodType = (typeof affixMoodEnum.enumValues)[number];

export const affixRules = pgTable(
  "affix_rules",
  {
    id: serial("id").primaryKey(),
    mood: affixMoodEnum("mood").notNull(),
    person: personTypeEnum("person").notNull(),
    form: integer("form").notNull().default(1),
    prefix: text("prefix").default(""),
    suffix: text("suffix").default(""),
  },
  (table) => [unique("unique_affix_rule").on(table.mood, table.person, table.form)],
);

export type AffixRulesSelect = InferSelectModel<typeof affixRules>;
export type AffixRulesInsert = InferInsertModel<typeof affixRules>;
