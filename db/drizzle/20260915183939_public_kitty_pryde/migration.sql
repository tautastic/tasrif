CREATE TYPE "radical_kind" AS ENUM('sound', 'waw', 'ya', 'hamza');--> statement-breakpoint
CREATE TYPE "short_vowel" AS ENUM('a', 'i', 'u');--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "radical1_kind" "radical_kind" DEFAULT 'sound'::"radical_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "radical2_kind" "radical_kind" DEFAULT 'sound'::"radical_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "radical3_kind" "radical_kind" DEFAULT 'sound'::"radical_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "is_geminate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "perfect_vowel" "short_vowel";--> statement-breakpoint
ALTER TABLE "morph_pattern" ADD COLUMN "imperfect_vowel" "short_vowel";