import { sql } from "drizzle-orm";
import { boolean, integer, pgView, smallint, text, varchar } from "drizzle-orm/pg-core";
import { senseRelationTypeEnum } from "~/server/db/schema/senseRelation";

export const senseTranslationView = pgView("sense_translation_normalized", {
  senseId: integer("sense_id").notNull(),
  targetSenseId: integer("target_sense_id").notNull(),
  targetText: varchar("target_text", { length: 255 }).notNull(),
  targetNormalizedText: text("target_normalized_text").notNull(),
  domain: varchar("domain", { length: 50 }),
  note: text("note"),
  frequencyRank: smallint("frequency_rank"),
  targetSlug: text("target_slug").notNull(),
}).as(
  sql`
    SELECT
      sense_id,
      target_sense_id,
      target_text,
      target_normalized_text,
      domain,
      note,
      frequency_rank,
      target_slug
    FROM (
      SELECT DISTINCT ON (sense_id, target_sense_id)
        sense_id,
        target_sense_id,
        target_text,
        target_normalized_text,
        domain,
        note,
        frequency_rank,
        target_slug
      FROM (
        SELECT
          tl.en_sense_id AS sense_id,
          tl.ar_sense_id AS target_sense_id,
          ar_le.text AS target_text,
          ar_le.normalized_text AS target_normalized_text,
          tl.domain,
          tl.note,
          tl.frequency_rank,
          ar_le.slug AS target_slug
        FROM translation_link tl
          INNER JOIN sense ar_s ON tl.ar_sense_id = ar_s.id
          INNER JOIN lexical_entry ar_le ON ar_s.lexical_entry_id = ar_le.id
        UNION ALL
        SELECT
          tl.ar_sense_id AS sense_id,
          tl.en_sense_id AS target_sense_id,
          en_le.text AS target_text,
          en_le.normalized_text AS target_normalized_text,
          tl.domain,
          tl.note,
          tl.frequency_rank,
          en_le.slug AS target_slug
        FROM translation_link tl
          INNER JOIN sense en_s ON tl.en_sense_id = en_s.id
          INNER JOIN lexical_entry en_le ON en_s.lexical_entry_id = en_le.id
      ) AS combined
      ORDER BY sense_id, target_sense_id, frequency_rank
    ) AS deduped
    ORDER BY sense_id, target_normalized_text, frequency_rank, target_sense_id
    `,
);

export const senseRelationView = pgView("sense_relation_normalized", {
  senseId: integer("sense_id").notNull(),
  targetSenseId: integer("target_sense_id").notNull(),
  targetText: varchar("target_text", { length: 255 }).notNull(),
  targetNormalizedText: text("target_normalized_text").notNull(),
  relationType: senseRelationTypeEnum("relation_type").notNull(),
  contextNote: text("context_note"),
  strength: smallint("strength"),
  targetSlug: text("target_slug").notNull(),
}).as(
  sql`
  SELECT
      sense_id,
      target_sense_id,
      target_text,
      target_normalized_text,
      relation_type,
      context_note,
      strength,
      target_slug
  FROM (
    SELECT DISTINCT ON (sense_id, target_sense_id, relation_type)
        sense_id,
        target_sense_id,
        target_text,
        target_normalized_text,
        relation_type,
        context_note,
        strength,
        target_slug
    FROM (
        SELECT
        sr.sense_id_1 AS sense_id,
        sr.sense_id_2 AS target_sense_id,
        le.text AS target_text,
        le.normalized_text AS target_normalized_text,
        sr.relation_type,
        sr.context_note,
        sr.strength,
        le.slug AS target_slug
        FROM sense_relation sr
        INNER JOIN sense s ON sr.sense_id_2 = s.id
        INNER JOIN lexical_entry le ON s.lexical_entry_id = le.id
        UNION ALL
        SELECT
        sr.sense_id_2 AS sense_id,
        sr.sense_id_1 AS target_sense_id,
        le.text AS target_text,
        le.normalized_text AS target_normalized_text,
        CASE sr.relation_type
        WHEN 'hyponym'  THEN 'hypernym'
        WHEN 'hypernym' THEN 'hyponym'
        ELSE sr.relation_type
        END AS relation_type,
        sr.context_note,
        sr.strength,
        le.slug AS target_slug
        FROM sense_relation sr
        INNER JOIN sense s ON sr.sense_id_1 = s.id
        INNER JOIN lexical_entry le ON s.lexical_entry_id = le.id
      ) AS combined
    ORDER BY sense_id, target_sense_id, relation_type, strength DESC NULLS LAST
  ) AS deduped
  ORDER BY sense_id, target_normalized_text, relation_type, target_sense_id
    `,
);

export const lexicalEntryDerivedStatusView = pgView("lexical_entry_derived_status", {
  lexicalEntryId: integer("lexical_entry_id").notNull(),
  hasPattern: boolean("has_pattern").notNull(),
  hasVerbalNouns: boolean("has_verbal_nouns").notNull(),
  conjugationCount: integer("conjugation_count").notNull(),
  needsAttention: boolean("needs_attention").notNull(),
}).as(
  sql`
    SELECT
      le.id AS lexical_entry_id,
      le.morph_pattern_id IS NOT NULL AS has_pattern,
      (le.masdar IS NOT NULL OR le.active_participle IS NOT NULL OR le.passive_participle IS NOT NULL) AS has_verbal_nouns,
      (SELECT count(*) FROM conjugation c WHERE c.lexical_entry_id = le.id)::integer AS conjugation_count,
      (le.morph_pattern_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM conjugation c WHERE c.lexical_entry_id = le.id)) AS needs_attention
    FROM lexical_entry le
  `,
);
