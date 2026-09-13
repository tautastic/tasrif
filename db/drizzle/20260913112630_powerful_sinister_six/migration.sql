CREATE TYPE "affix_mood" AS ENUM('perfect', 'imperative', 'imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive');--> statement-breakpoint
CREATE TYPE "person_type" AS ENUM('first_person_singular', 'second_person_masculine_singular', 'second_person_feminine_singular', 'third_person_masculine_singular', 'third_person_feminine_singular', 'second_person_dual', 'third_person_masculine_dual', 'third_person_feminine_dual', 'first_person_plural', 'second_person_masculine_plural', 'second_person_feminine_plural', 'third_person_masculine_plural', 'third_person_feminine_plural');--> statement-breakpoint
CREATE TYPE "lang_type" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "pos_type" AS ENUM('noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'interjection', 'pronoun', 'determiner', 'particle', 'adverbial_phrase', 'idiom');--> statement-breakpoint
CREATE TYPE "sense_relation_type" AS ENUM('synonym', 'antonym', 'hyponym', 'hypernym', 'near_synonym');--> statement-breakpoint
CREATE TABLE "affix_rules" (
	"id" serial PRIMARY KEY,
	"mood" "affix_mood" NOT NULL,
	"person" "person_type" NOT NULL,
	"form" integer DEFAULT 1 NOT NULL,
	"prefix" text DEFAULT '',
	"suffix" text DEFAULT '',
	CONSTRAINT "unique_affix_rule" UNIQUE("mood","person","form")
);
--> statement-breakpoint
CREATE TABLE "conjugation" (
	"id" serial PRIMARY KEY,
	"lexical_entry_id" integer NOT NULL,
	"mood" "affix_mood" NOT NULL,
	"first_person_singular" text,
	"second_person_masculine_singular" text,
	"second_person_feminine_singular" text,
	"third_person_masculine_singular" text,
	"third_person_feminine_singular" text,
	"second_person_dual" text,
	"third_person_masculine_dual" text,
	"third_person_feminine_dual" text,
	"first_person_plural" text,
	"second_person_masculine_plural" text,
	"second_person_feminine_plural" text,
	"third_person_masculine_plural" text,
	"third_person_feminine_plural" text,
	CONSTRAINT "unique_conjugation_entry_mood" UNIQUE("lexical_entry_id","mood")
);
--> statement-breakpoint
CREATE TABLE "lexical_entry" (
	"id" serial PRIMARY KEY,
	"language" "lang_type" NOT NULL,
	"text" varchar(255) NOT NULL,
	"normalized_text" text GENERATED ALWAYS AS (LOWER(REGEXP_REPLACE(text, '[[:punct:][:space:]ً-ٰٟؐ-ؚ]', '', 'g'))) STORED NOT NULL,
	"root" varchar(10),
	"latin_root" varchar(20),
	"morph_pattern_id" integer,
	"morphology_overrides" jsonb,
	"masdar" text,
	"active_participle" text,
	"passive_participle" text,
	"search_vector" tsvector,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_language_text" UNIQUE("language","text")
);
--> statement-breakpoint
CREATE TABLE "morph_pattern" (
	"id" serial PRIMARY KEY,
	"form_number" smallint NOT NULL,
	"vocalic_template" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"rules" jsonb NOT NULL,
	"no_affix" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_form_number_description" UNIQUE("form_number","description")
);
--> statement-breakpoint
CREATE TABLE "sense" (
	"id" serial PRIMARY KEY,
	"lexical_entry_id" integer NOT NULL,
	"pos" "pos_type" NOT NULL,
	"sense_number" smallint NOT NULL,
	"definitions" text[] DEFAULT '{}'::text[] NOT NULL,
	"context_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"examples" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "unique_sense_number" UNIQUE("lexical_entry_id","sense_number")
);
--> statement-breakpoint
CREATE TABLE "sense_relation" (
	"id" serial PRIMARY KEY,
	"sense_id_1" integer NOT NULL,
	"sense_id_2" integer NOT NULL,
	"relation_type" "sense_relation_type" NOT NULL,
	"strength" smallint DEFAULT 5,
	"context_note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_relation" UNIQUE("sense_id_1","sense_id_2","relation_type"),
	CONSTRAINT "sense_different" CHECK (sense_id_1 != sense_id_2)
);
--> statement-breakpoint
CREATE TABLE "translation_link" (
	"id" serial PRIMARY KEY,
	"en_sense_id" integer NOT NULL,
	"ar_sense_id" integer NOT NULL,
	"frequency_rank" smallint DEFAULT 5,
	"domain" varchar(50),
	"note" text,
	CONSTRAINT "unique_translation" UNIQUE("en_sense_id","ar_sense_id")
);
--> statement-breakpoint
CREATE INDEX "idx_conjugation_entry" ON "conjugation" ("lexical_entry_id");--> statement-breakpoint
CREATE INDEX "idx_conjugation_mood" ON "conjugation" ("mood");--> statement-breakpoint
CREATE INDEX "idx_lexical_entry_root" ON "lexical_entry" ("root");--> statement-breakpoint
CREATE INDEX "idx_lexical_entry_latin_root" ON "lexical_entry" ("latin_root");--> statement-breakpoint
CREATE INDEX "idx_lexical_entry_pattern" ON "lexical_entry" ("morph_pattern_id");--> statement-breakpoint
CREATE INDEX "idx_lexical_entry_text_trgm" ON "lexical_entry" USING gin ("text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_lexical_entry_search_vector" ON "lexical_entry" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "idx_lexical_entry_language_created_at" ON "lexical_entry" ("language","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_form_number" ON "morph_pattern" ("form_number");--> statement-breakpoint
CREATE INDEX "idx_description" ON "morph_pattern" ("description");--> statement-breakpoint
CREATE INDEX "idx_sense_definitions" ON "sense" USING gin ("definitions");--> statement-breakpoint
CREATE INDEX "idx_sense_context_tags" ON "sense" USING gin ("context_tags");--> statement-breakpoint
ALTER TABLE "conjugation" ADD CONSTRAINT "conjugation_lexical_entry_id_lexical_entry_id_fkey" FOREIGN KEY ("lexical_entry_id") REFERENCES "lexical_entry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lexical_entry" ADD CONSTRAINT "lexical_entry_morph_pattern_id_morph_pattern_id_fkey" FOREIGN KEY ("morph_pattern_id") REFERENCES "morph_pattern"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sense" ADD CONSTRAINT "sense_lexical_entry_id_lexical_entry_id_fkey" FOREIGN KEY ("lexical_entry_id") REFERENCES "lexical_entry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sense_relation" ADD CONSTRAINT "sense_relation_sense_id_1_sense_id_fkey" FOREIGN KEY ("sense_id_1") REFERENCES "sense"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sense_relation" ADD CONSTRAINT "sense_relation_sense_id_2_sense_id_fkey" FOREIGN KEY ("sense_id_2") REFERENCES "sense"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "translation_link" ADD CONSTRAINT "translation_link_en_sense_id_sense_id_fkey" FOREIGN KEY ("en_sense_id") REFERENCES "sense"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "translation_link" ADD CONSTRAINT "translation_link_ar_sense_id_sense_id_fkey" FOREIGN KEY ("ar_sense_id") REFERENCES "sense"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE VIEW "sense_relation_normalized" AS (
  SELECT DISTINCT ON (sense_id, target_normalized_text, relation_type)
      sense_id,
      target_sense_id,
      target_text,
      target_normalized_text,
      relation_type,
      context_note,
      strength
  FROM (
      SELECT
      sr.sense_id_1 AS sense_id,
      sr.sense_id_2 AS target_sense_id,
      le.text AS target_text,
      le.normalized_text AS target_normalized_text,
      sr.relation_type,
      sr.context_note,
      sr.strength
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
      sr.strength
      FROM sense_relation sr
      INNER JOIN sense s ON sr.sense_id_1 = s.id
      INNER JOIN lexical_entry le ON s.lexical_entry_id = le.id
      ) AS combined
  ORDER BY sense_id, target_normalized_text, relation_type, target_sense_id
    );--> statement-breakpoint
CREATE VIEW "sense_translation_normalized" AS (
    SELECT DISTINCT ON (sense_id, target_normalized_text)
      sense_id,
      target_sense_id,
      target_text,
      target_normalized_text,
      domain,
      note,
      frequency_rank
    FROM (
      SELECT
        tl.en_sense_id AS sense_id,
        tl.ar_sense_id AS target_sense_id,
        ar_le.text AS target_text,
        ar_le.normalized_text AS target_normalized_text,
        tl.domain,
        tl.note,
        tl.frequency_rank
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
        tl.frequency_rank
      FROM translation_link tl
        INNER JOIN sense en_s ON tl.en_sense_id = en_s.id
        INNER JOIN lexical_entry en_le ON en_s.lexical_entry_id = en_le.id
    ) AS combined
    ORDER BY sense_id, target_normalized_text, frequency_rank, target_sense_id
    );