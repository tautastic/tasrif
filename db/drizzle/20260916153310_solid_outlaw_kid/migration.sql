CREATE TABLE "lexical_pattern_override" (
	"id" serial PRIMARY KEY,
	"root" varchar(10) NOT NULL,
	"form_number" smallint NOT NULL,
	"perfect_vowel" "short_vowel",
	"imperfect_vowel" "short_vowel",
	"morph_pattern_id" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lexical_pattern_override_key" UNIQUE NULLS NOT DISTINCT("root","form_number","perfect_vowel","imperfect_vowel"),
	CONSTRAINT "chk_lexical_pattern_override_form1_vowels" CHECK (("form_number" = 1) = ("perfect_vowel" IS NOT NULL AND "imperfect_vowel" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "is_lexical" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_lexical_pattern_override_pattern" ON "lexical_pattern_override" ("morph_pattern_id");--> statement-breakpoint
ALTER TABLE "lexical_pattern_override" ADD CONSTRAINT "lexical_pattern_override_morph_pattern_id_morph_pattern_id_fkey" FOREIGN KEY ("morph_pattern_id") REFERENCES "morph_pattern"("id") ON DELETE CASCADE;