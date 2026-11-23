CREATE TYPE "public"."alias_type" AS ENUM('courtesy', 'art_name', 'alias', 'variant');--> statement-breakpoint
CREATE TYPE "public"."attribution_status" AS ENUM('attributed', 'disputed', 'anonymous');--> statement-breakpoint
CREATE TYPE "public"."attribution_type" AS ENUM('primary', 'secondary', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."date_precision" AS ENUM('exact', 'approx', 'period', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."genre" AS ENUM('shi', 'ci', 'qu');--> statement-breakpoint
CREATE TYPE "public"."impact_tier" AS ENUM('A', 'B', 'C', 'unranked');--> statement-breakpoint
CREATE TYPE "public"."membership_type" AS ENUM('primary', 'secondary', 'transition');--> statement-breakpoint
CREATE TYPE "public"."period_kind" AS ENUM('dynasty', 'era', 'realm', 'literary');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('published', 'draft', 'retracted');--> statement-breakpoint
CREATE TYPE "public"."relation_direction" AS ENUM('undirected', 'a_to_b', 'b_to_a');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('friendship', 'teacher_student', 'literary_influence', 'association', 'kinship');--> statement-breakpoint
CREATE TYPE "public"."rights_status" AS ENUM('cleared', 'restricted', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."sky_mode" AS ENUM('river', 'galaxy');--> statement-breakpoint
CREATE TABLE "app_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_name" text NOT NULL,
	"version" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"statistics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layout_positions" (
	"poet_id" text NOT NULL,
	"mode" "sky_mode" NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"layout_version" text NOT NULL,
	CONSTRAINT "layout_positions_poet_id_mode_layout_version_pk" PRIMARY KEY("poet_id","mode","layout_version")
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer NOT NULL,
	"parent_id" text,
	"period_kind" "period_kind" DEFAULT 'era' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"parallel" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poet_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"poet_id" text NOT NULL,
	"alias" text NOT NULL,
	"alias_type" "alias_type" DEFAULT 'alias' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poet_periods" (
	"poet_id" text NOT NULL,
	"period_id" text NOT NULL,
	"membership_type" "membership_type" DEFAULT 'primary' NOT NULL,
	"evidence_id" text,
	CONSTRAINT "poet_periods_poet_id_period_id_pk" PRIMARY KEY("poet_id","period_id")
);
--> statement-breakpoint
CREATE TABLE "poet_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"poet_a_id" text NOT NULL,
	"poet_b_id" text NOT NULL,
	"relation_type" "relation_type" NOT NULL,
	"direction" "relation_direction" DEFAULT 'undirected' NOT NULL,
	"source_id" text,
	"confidence" "confidence" DEFAULT 'low' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"publish_status" "publish_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poets" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"initial" text NOT NULL,
	"dynasty_label" text DEFAULT '' NOT NULL,
	"bio_short" text DEFAULT '' NOT NULL,
	"birth_year" integer,
	"death_year" integer,
	"activity_start" integer,
	"activity_end" integer,
	"date_precision" date_precision DEFAULT 'unknown' NOT NULL,
	"date_note" text DEFAULT '' NOT NULL,
	"impact_tier" "impact_tier" DEFAULT 'unranked' NOT NULL,
	"impact_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impact_review_note" text DEFAULT '' NOT NULL,
	"primary_period_id" text,
	"publish_status" "publish_status" DEFAULT 'draft' NOT NULL,
	"data_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"editor" text,
	"edition" text,
	"url_or_bib" text,
	"license" text DEFAULT 'unknown' NOT NULL,
	"rights_status" "rights_status" DEFAULT 'pending_review' NOT NULL,
	"rights_note" text,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_authors" (
	"work_id" text NOT NULL,
	"poet_id" text NOT NULL,
	"attribution_type" "attribution_type" DEFAULT 'primary' NOT NULL,
	"evidence_id" text,
	CONSTRAINT "work_authors_work_id_poet_id_pk" PRIMARY KEY("work_id","poet_id")
);
--> statement-breakpoint
CREATE TABLE "work_sources" (
	"work_id" text NOT NULL,
	"source_id" text NOT NULL,
	"relation_type" text DEFAULT 'text' NOT NULL,
	"source_locator" text,
	CONSTRAINT "work_sources_work_id_source_id_pk" PRIMARY KEY("work_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "work_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"source_id" text,
	"variant_text" text NOT NULL,
	"variant_note" text
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"poet_id" text,
	"title" text NOT NULL,
	"genre" "genre" DEFAULT 'shi' NOT NULL,
	"text_original" text NOT NULL,
	"text_normalized" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"attribution_status" "attribution_status" DEFAULT 'attributed' NOT NULL,
	"publish_status" "publish_status" DEFAULT 'draft' NOT NULL,
	"rights_status" "rights_status" DEFAULT 'pending_review' NOT NULL,
	"canonical_work_id" text,
	"source_id" text,
	"source_locator" text,
	"content_hash" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layout_positions" ADD CONSTRAINT "layout_positions_poet_id_poets_id_fk" FOREIGN KEY ("poet_id") REFERENCES "public"."poets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_aliases" ADD CONSTRAINT "poet_aliases_poet_id_poets_id_fk" FOREIGN KEY ("poet_id") REFERENCES "public"."poets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_periods" ADD CONSTRAINT "poet_periods_poet_id_poets_id_fk" FOREIGN KEY ("poet_id") REFERENCES "public"."poets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_periods" ADD CONSTRAINT "poet_periods_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_periods" ADD CONSTRAINT "poet_periods_evidence_id_sources_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_relations" ADD CONSTRAINT "poet_relations_poet_a_id_poets_id_fk" FOREIGN KEY ("poet_a_id") REFERENCES "public"."poets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_relations" ADD CONSTRAINT "poet_relations_poet_b_id_poets_id_fk" FOREIGN KEY ("poet_b_id") REFERENCES "public"."poets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_relations" ADD CONSTRAINT "poet_relations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poets" ADD CONSTRAINT "poets_primary_period_id_periods_id_fk" FOREIGN KEY ("primary_period_id") REFERENCES "public"."periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_poet_id_poets_id_fk" FOREIGN KEY ("poet_id") REFERENCES "public"."poets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_evidence_id_sources_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sources" ADD CONSTRAINT "work_sources_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sources" ADD CONSTRAINT "work_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_variants" ADD CONSTRAINT "work_variants_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_variants" ADD CONSTRAINT "work_variants_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_poet_id_poets_id_fk" FOREIGN KEY ("poet_id") REFERENCES "public"."poets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_jobs_imported_idx" ON "ingestion_jobs" USING btree ("imported_at");--> statement-breakpoint
CREATE INDEX "layout_positions_mode_idx" ON "layout_positions" USING btree ("mode","layout_version");--> statement-breakpoint
CREATE INDEX "layout_positions_bbox_idx" ON "layout_positions" USING btree ("mode","layout_version","x","y");--> statement-breakpoint
CREATE INDEX "periods_sort_order_idx" ON "periods" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "poet_aliases_poet_idx" ON "poet_aliases" USING btree ("poet_id");--> statement-breakpoint
CREATE INDEX "poet_aliases_alias_idx" ON "poet_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "poet_relations_a_idx" ON "poet_relations" USING btree ("poet_a_id");--> statement-breakpoint
CREATE INDEX "poet_relations_b_idx" ON "poet_relations" USING btree ("poet_b_id");--> statement-breakpoint
CREATE INDEX "poets_publish_status_idx" ON "poets" USING btree ("publish_status");--> statement-breakpoint
CREATE INDEX "poets_primary_period_idx" ON "poets" USING btree ("primary_period_id");--> statement-breakpoint
CREATE INDEX "poets_name_idx" ON "poets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "work_variants_work_idx" ON "work_variants" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "works_poet_idx" ON "works" USING btree ("poet_id");--> statement-breakpoint
CREATE INDEX "works_publish_status_idx" ON "works" USING btree ("publish_status");--> statement-breakpoint
CREATE INDEX "works_poet_order_idx" ON "works" USING btree ("poet_id","featured","title");--> statement-breakpoint
CREATE INDEX "works_content_hash_idx" ON "works" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "works_genre_idx" ON "works" USING btree ("genre");