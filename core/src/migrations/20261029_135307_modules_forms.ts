import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mod_forms_forms_fields_type" AS ENUM('text', 'email', 'phone', 'textarea', 'checkbox');
  CREATE TYPE "public"."enum__mod_forms_forms_v_version_fields_type" AS ENUM('text', 'email', 'phone', 'textarea', 'checkbox');
  CREATE TYPE "public"."enum_mod_forms_submissions_status" AS ENUM('new', 'progress', 'done');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'renote-event-dispatch', 'renote-event-deliver');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'renote-event-dispatch', 'renote-event-deliver');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'renote-event-dispatch', 'renote-event-deliver');
  CREATE TABLE "pages_blocks_forms_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_forms_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "mod_forms_forms_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_mod_forms_forms_fields_type" DEFAULT 'text' NOT NULL,
  	"required" boolean
  );
  
  CREATE TABLE "mod_forms_forms_fields_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "mod_forms_forms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mod_forms_forms_locales" (
  	"success_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "mod_forms_forms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "_mod_forms_forms_v_version_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum__mod_forms_forms_v_version_fields_type" DEFAULT 'text' NOT NULL,
  	"required" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_mod_forms_forms_v_version_fields_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_mod_forms_forms_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_mod_forms_forms_v_locales" (
  	"version_success_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_mod_forms_forms_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "mod_forms_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer NOT NULL,
  	"data" jsonb,
  	"status" "enum_mod_forms_submissions_status" DEFAULT 'new',
  	"ip" varchar,
  	"notified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mod_forms_submissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "cell_modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"module_id" varchar NOT NULL,
  	"installed" boolean DEFAULT false,
  	"installed_at" timestamp(3) with time zone,
  	"uninstalled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cell_modules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb NOT NULL,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb,
  	"parent_task_slug" "enum_payload_jobs_log_parent_task_slug",
  	"parent_task_i_d" varchar
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"meta" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing_until" timestamp(3) with time zone,
  	"processing_token" varchar,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mod_forms_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"notify_email" varchar NOT NULL,
  	"store_ip" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "mod_forms_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mod_forms_forms_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mod_forms_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "cell_modules_id" integer;
  ALTER TABLE "pages_blocks_forms_form" ADD CONSTRAINT "pages_blocks_forms_form_form_id_mod_forms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_forms_form" ADD CONSTRAINT "pages_blocks_forms_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_forms_form" ADD CONSTRAINT "_pages_v_blocks_forms_form_form_id_mod_forms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_forms_form" ADD CONSTRAINT "_pages_v_blocks_forms_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_forms_fields" ADD CONSTRAINT "mod_forms_forms_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_forms_fields_locales" ADD CONSTRAINT "mod_forms_forms_fields_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mod_forms_forms_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_forms_locales" ADD CONSTRAINT "mod_forms_forms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_forms_rels" ADD CONSTRAINT "mod_forms_forms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_forms_rels" ADD CONSTRAINT "mod_forms_forms_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_forms_forms_v_version_fields" ADD CONSTRAINT "_mod_forms_forms_v_version_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_mod_forms_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_forms_forms_v_version_fields_locales" ADD CONSTRAINT "_mod_forms_forms_v_version_fields_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_mod_forms_forms_v_version_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_forms_forms_v" ADD CONSTRAINT "_mod_forms_forms_v_parent_id_mod_forms_forms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mod_forms_forms_v_locales" ADD CONSTRAINT "_mod_forms_forms_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_mod_forms_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_forms_forms_v_rels" ADD CONSTRAINT "_mod_forms_forms_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_mod_forms_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_forms_forms_v_rels" ADD CONSTRAINT "_mod_forms_forms_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_submissions" ADD CONSTRAINT "mod_forms_submissions_form_id_mod_forms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mod_forms_submissions_rels" ADD CONSTRAINT "mod_forms_submissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_forms_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_submissions_rels" ADD CONSTRAINT "mod_forms_submissions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cell_modules_rels" ADD CONSTRAINT "cell_modules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cell_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cell_modules_rels" ADD CONSTRAINT "cell_modules_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_settings_rels" ADD CONSTRAINT "mod_forms_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_forms_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_forms_settings_rels" ADD CONSTRAINT "mod_forms_settings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_forms_form_order_idx" ON "pages_blocks_forms_form" USING btree ("_order");
  CREATE INDEX "pages_blocks_forms_form_parent_id_idx" ON "pages_blocks_forms_form" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_forms_form_path_idx" ON "pages_blocks_forms_form" USING btree ("_path");
  CREATE INDEX "pages_blocks_forms_form_form_idx" ON "pages_blocks_forms_form" USING btree ("form_id");
  CREATE INDEX "_pages_v_blocks_forms_form_order_idx" ON "_pages_v_blocks_forms_form" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_forms_form_parent_id_idx" ON "_pages_v_blocks_forms_form" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_forms_form_path_idx" ON "_pages_v_blocks_forms_form" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_forms_form_form_idx" ON "_pages_v_blocks_forms_form" USING btree ("form_id");
  CREATE INDEX "mod_forms_forms_fields_order_idx" ON "mod_forms_forms_fields" USING btree ("_order");
  CREATE INDEX "mod_forms_forms_fields_parent_id_idx" ON "mod_forms_forms_fields" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "mod_forms_forms_fields_locales_parent_id_locale_unique" ON "mod_forms_forms_fields_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "mod_forms_forms_updated_at_idx" ON "mod_forms_forms" USING btree ("updated_at");
  CREATE INDEX "mod_forms_forms_created_at_idx" ON "mod_forms_forms" USING btree ("created_at");
  CREATE UNIQUE INDEX "mod_forms_forms_locales_parent_id_locale_unique" ON "mod_forms_forms_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "mod_forms_forms_rels_order_idx" ON "mod_forms_forms_rels" USING btree ("order");
  CREATE INDEX "mod_forms_forms_rels_parent_idx" ON "mod_forms_forms_rels" USING btree ("parent_id");
  CREATE INDEX "mod_forms_forms_rels_path_idx" ON "mod_forms_forms_rels" USING btree ("path");
  CREATE INDEX "mod_forms_forms_rels_users_id_idx" ON "mod_forms_forms_rels" USING btree ("users_id");
  CREATE INDEX "_mod_forms_forms_v_version_fields_order_idx" ON "_mod_forms_forms_v_version_fields" USING btree ("_order");
  CREATE INDEX "_mod_forms_forms_v_version_fields_parent_id_idx" ON "_mod_forms_forms_v_version_fields" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_mod_forms_forms_v_version_fields_locales_parent_id_locale_u" ON "_mod_forms_forms_v_version_fields_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_mod_forms_forms_v_parent_idx" ON "_mod_forms_forms_v" USING btree ("parent_id");
  CREATE INDEX "_mod_forms_forms_v_version_version_updated_at_idx" ON "_mod_forms_forms_v" USING btree ("version_updated_at");
  CREATE INDEX "_mod_forms_forms_v_version_version_created_at_idx" ON "_mod_forms_forms_v" USING btree ("version_created_at");
  CREATE INDEX "_mod_forms_forms_v_created_at_idx" ON "_mod_forms_forms_v" USING btree ("created_at");
  CREATE INDEX "_mod_forms_forms_v_updated_at_idx" ON "_mod_forms_forms_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_mod_forms_forms_v_locales_parent_id_locale_unique" ON "_mod_forms_forms_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_mod_forms_forms_v_rels_order_idx" ON "_mod_forms_forms_v_rels" USING btree ("order");
  CREATE INDEX "_mod_forms_forms_v_rels_parent_idx" ON "_mod_forms_forms_v_rels" USING btree ("parent_id");
  CREATE INDEX "_mod_forms_forms_v_rels_path_idx" ON "_mod_forms_forms_v_rels" USING btree ("path");
  CREATE INDEX "_mod_forms_forms_v_rels_users_id_idx" ON "_mod_forms_forms_v_rels" USING btree ("users_id");
  CREATE INDEX "mod_forms_submissions_form_idx" ON "mod_forms_submissions" USING btree ("form_id");
  CREATE INDEX "mod_forms_submissions_updated_at_idx" ON "mod_forms_submissions" USING btree ("updated_at");
  CREATE INDEX "mod_forms_submissions_created_at_idx" ON "mod_forms_submissions" USING btree ("created_at");
  CREATE INDEX "mod_forms_submissions_rels_order_idx" ON "mod_forms_submissions_rels" USING btree ("order");
  CREATE INDEX "mod_forms_submissions_rels_parent_idx" ON "mod_forms_submissions_rels" USING btree ("parent_id");
  CREATE INDEX "mod_forms_submissions_rels_path_idx" ON "mod_forms_submissions_rels" USING btree ("path");
  CREATE INDEX "mod_forms_submissions_rels_users_id_idx" ON "mod_forms_submissions_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "cell_modules_module_id_idx" ON "cell_modules" USING btree ("module_id");
  CREATE INDEX "cell_modules_updated_at_idx" ON "cell_modules" USING btree ("updated_at");
  CREATE INDEX "cell_modules_created_at_idx" ON "cell_modules" USING btree ("created_at");
  CREATE INDEX "cell_modules_rels_order_idx" ON "cell_modules_rels" USING btree ("order");
  CREATE INDEX "cell_modules_rels_parent_idx" ON "cell_modules_rels" USING btree ("parent_id");
  CREATE INDEX "cell_modules_rels_path_idx" ON "cell_modules_rels" USING btree ("path");
  CREATE INDEX "cell_modules_rels_users_id_idx" ON "cell_modules_rels" USING btree ("users_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_until_idx" ON "payload_jobs" USING btree ("processing_until");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "mod_forms_settings_rels_order_idx" ON "mod_forms_settings_rels" USING btree ("order");
  CREATE INDEX "mod_forms_settings_rels_parent_idx" ON "mod_forms_settings_rels" USING btree ("parent_id");
  CREATE INDEX "mod_forms_settings_rels_path_idx" ON "mod_forms_settings_rels" USING btree ("path");
  CREATE INDEX "mod_forms_settings_rels_users_id_idx" ON "mod_forms_settings_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_fk" FOREIGN KEY ("mod_forms_forms_id") REFERENCES "public"."mod_forms_forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_submissions_fk" FOREIGN KEY ("mod_forms_submissions_id") REFERENCES "public"."mod_forms_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cell_modules_fk" FOREIGN KEY ("cell_modules_id") REFERENCES "public"."cell_modules"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_mod_forms_forms_id_idx" ON "payload_locked_documents_rels" USING btree ("mod_forms_forms_id");
  CREATE INDEX "payload_locked_documents_rels_mod_forms_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("mod_forms_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_cell_modules_id_idx" ON "payload_locked_documents_rels" USING btree ("cell_modules_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_forms_form" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_forms_form" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_forms_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_forms_fields_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_forms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_forms_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_forms_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_forms_forms_v_version_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_forms_forms_v_version_fields_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_forms_forms_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_forms_forms_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_forms_forms_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_submissions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cell_modules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cell_modules_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_forms_settings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_forms_form" CASCADE;
  DROP TABLE "_pages_v_blocks_forms_form" CASCADE;
  DROP TABLE "mod_forms_forms_fields" CASCADE;
  DROP TABLE "mod_forms_forms_fields_locales" CASCADE;
  DROP TABLE "mod_forms_forms" CASCADE;
  DROP TABLE "mod_forms_forms_locales" CASCADE;
  DROP TABLE "mod_forms_forms_rels" CASCADE;
  DROP TABLE "_mod_forms_forms_v_version_fields" CASCADE;
  DROP TABLE "_mod_forms_forms_v_version_fields_locales" CASCADE;
  DROP TABLE "_mod_forms_forms_v" CASCADE;
  DROP TABLE "_mod_forms_forms_v_locales" CASCADE;
  DROP TABLE "_mod_forms_forms_v_rels" CASCADE;
  DROP TABLE "mod_forms_submissions" CASCADE;
  DROP TABLE "mod_forms_submissions_rels" CASCADE;
  DROP TABLE "cell_modules" CASCADE;
  DROP TABLE "cell_modules_rels" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "mod_forms_settings" CASCADE;
  DROP TABLE "mod_forms_settings_rels" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forms_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forms_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_cell_modules_fk";
  
  DROP INDEX "payload_locked_documents_rels_mod_forms_forms_id_idx";
  DROP INDEX "payload_locked_documents_rels_mod_forms_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_cell_modules_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mod_forms_forms_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mod_forms_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "cell_modules_id";
  DROP TYPE "public"."enum_mod_forms_forms_fields_type";
  DROP TYPE "public"."enum__mod_forms_forms_v_version_fields_type";
  DROP TYPE "public"."enum_mod_forms_submissions_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
