CREATE TYPE "public"."data_tier" AS ENUM('curated', 'imported');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('curated', 'imported');--> statement-breakpoint
ALTER TABLE "poets" ADD COLUMN "data_tier" "data_tier" DEFAULT 'curated' NOT NULL;--> statement-breakpoint
ALTER TABLE "poets" ADD COLUMN "sky_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "poets" ADD COLUMN "corpus_key" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "text_fingerprint" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "verification_status" "verification_status" DEFAULT 'curated' NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "quality_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "source_external_id" text;--> statement-breakpoint
CREATE INDEX "poets_sky_visible_idx" ON "poets" USING btree ("sky_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "poets_corpus_key_idx" ON "poets" USING btree ("corpus_key");--> statement-breakpoint
CREATE INDEX "works_poet_fingerprint_idx" ON "works" USING btree ("poet_id","text_fingerprint");--> statement-breakpoint
CREATE INDEX "works_verification_idx" ON "works" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "works_source_external_idx" ON "works" USING btree ("source_external_id");