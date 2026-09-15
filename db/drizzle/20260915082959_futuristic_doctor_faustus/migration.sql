CREATE TYPE "voice_type" AS ENUM('active', 'passive');--> statement-breakpoint
ALTER TABLE "conjugation" DROP CONSTRAINT "unique_conjugation_entry_mood";--> statement-breakpoint
ALTER TABLE "conjugation" ADD COLUMN "voice" "voice_type" DEFAULT 'active'::"voice_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "conjugation" ADD COLUMN "person" "person_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "conjugation" ADD COLUMN "form" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lexical_entry" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "first_person_singular";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "second_person_masculine_singular";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "second_person_feminine_singular";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "third_person_masculine_singular";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "third_person_feminine_singular";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "second_person_dual";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "third_person_masculine_dual";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "third_person_feminine_dual";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "first_person_plural";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "second_person_masculine_plural";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "second_person_feminine_plural";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "third_person_masculine_plural";--> statement-breakpoint
ALTER TABLE "conjugation" DROP COLUMN "third_person_feminine_plural";--> statement-breakpoint
ALTER TABLE "conjugation" ADD CONSTRAINT "unique_conjugation_entry_voice_mood_person" UNIQUE("lexical_entry_id","voice","mood","person");