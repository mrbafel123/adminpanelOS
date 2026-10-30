import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mod_legal_documents_kind" AS ENUM('privacy', 'consent', 'terms', 'cookies', 'other');
  CREATE TYPE "public"."enum_mod_legal_documents_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__mod_legal_documents_v_version_kind" AS ENUM('privacy', 'consent', 'terms', 'cookies', 'other');
  CREATE TYPE "public"."enum__mod_legal_documents_v_published_locale" AS ENUM('ru', 'en');
  CREATE TYPE "public"."enum__mod_legal_documents_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_mod_redirects_rules_code" AS ENUM('301', '302', '307', '308');
  CREATE TYPE "public"."enum_mod_redirects_rules_source" AS ENUM('manual', 'auto', 'import');
  CREATE TYPE "public"."enum_mod_seo_settings_sitemap_changefreq" AS ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never');
  CREATE TABLE "mod_legal_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"kind" "enum_mod_legal_documents_kind" DEFAULT 'privacy',
  	"required" boolean,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mod_legal_documents_locales" (
  	"title" varchar,
  	"content" jsonb,
  	"_status" "enum_mod_legal_documents_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "mod_legal_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "_mod_legal_documents_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_kind" "enum__mod_legal_documents_v_version_kind" DEFAULT 'privacy',
  	"version_required" boolean,
  	"version_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"published_locale" "enum__mod_legal_documents_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_mod_legal_documents_v_locales" (
  	"version_title" varchar,
  	"version_content" jsonb,
  	"version__status" "enum__mod_legal_documents_v_version_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_mod_legal_documents_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "mod_legal_consents_documents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"title" varchar,
  	"version" varchar,
  	"hash" varchar
  );
  
  CREATE TABLE "mod_legal_consents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subject" varchar NOT NULL,
  	"source" varchar,
  	"ip" varchar,
  	"given_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mod_legal_consents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "mod_redirects_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar NOT NULL,
  	"code" "enum_mod_redirects_rules_code" DEFAULT '301' NOT NULL,
  	"active" boolean DEFAULT true,
  	"source" "enum_mod_redirects_rules_source" DEFAULT 'manual',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mod_redirects_rules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "mod_seo_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"index_site" boolean DEFAULT true,
  	"title_template" varchar DEFAULT '%s — %site',
  	"default_description" varchar,
  	"default_og_image" varchar,
  	"robots_disallow" varchar,
  	"robots_extra" varchar,
  	"sitemap_changefreq" "enum_mod_seo_settings_sitemap_changefreq" DEFAULT 'weekly',
  	"breadcrumbs_home" varchar DEFAULT 'Главная',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "mod_seo_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  DROP INDEX "pages_slug_idx";
  ALTER TABLE "pages" ADD COLUMN "path" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_og_image_id" integer;
  ALTER TABLE "pages" ADD COLUMN "seo_noindex" boolean;
  ALTER TABLE "pages" ADD COLUMN "seo_nofollow" boolean;
  ALTER TABLE "pages" ADD COLUMN "seo_canonical" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_json_ld" jsonb;
  ALTER TABLE "pages_locales" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "pages_locales" ADD COLUMN "seo_description" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_path" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_og_image_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_noindex" boolean;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_nofollow" boolean;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_canonical" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_json_ld" jsonb;
  ALTER TABLE "_pages_v_locales" ADD COLUMN "version_seo_title" varchar;
  ALTER TABLE "_pages_v_locales" ADD COLUMN "version_seo_description" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mod_legal_documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mod_legal_consents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mod_redirects_rules_id" integer;
  ALTER TABLE "mod_legal_documents_locales" ADD CONSTRAINT "mod_legal_documents_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mod_legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_legal_documents_rels" ADD CONSTRAINT "mod_legal_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_legal_documents_rels" ADD CONSTRAINT "mod_legal_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_legal_documents_v" ADD CONSTRAINT "_mod_legal_documents_v_parent_id_mod_legal_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_legal_documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mod_legal_documents_v_locales" ADD CONSTRAINT "_mod_legal_documents_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_mod_legal_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_legal_documents_v_rels" ADD CONSTRAINT "_mod_legal_documents_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_mod_legal_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mod_legal_documents_v_rels" ADD CONSTRAINT "_mod_legal_documents_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_legal_consents_documents" ADD CONSTRAINT "mod_legal_consents_documents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mod_legal_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_legal_consents_rels" ADD CONSTRAINT "mod_legal_consents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_legal_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_legal_consents_rels" ADD CONSTRAINT "mod_legal_consents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_redirects_rules_rels" ADD CONSTRAINT "mod_redirects_rules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_redirects_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_redirects_rules_rels" ADD CONSTRAINT "mod_redirects_rules_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_seo_settings_rels" ADD CONSTRAINT "mod_seo_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mod_seo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mod_seo_settings_rels" ADD CONSTRAINT "mod_seo_settings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "mod_legal_documents_slug_idx" ON "mod_legal_documents" USING btree ("slug");
  CREATE INDEX "mod_legal_documents_updated_at_idx" ON "mod_legal_documents" USING btree ("updated_at");
  CREATE INDEX "mod_legal_documents_created_at_idx" ON "mod_legal_documents" USING btree ("created_at");
  CREATE INDEX "mod_legal_documents__status_idx" ON "mod_legal_documents_locales" USING btree ("_status","_locale");
  CREATE UNIQUE INDEX "mod_legal_documents_locales_parent_id_locale_unique" ON "mod_legal_documents_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "mod_legal_documents_rels_order_idx" ON "mod_legal_documents_rels" USING btree ("order");
  CREATE INDEX "mod_legal_documents_rels_parent_idx" ON "mod_legal_documents_rels" USING btree ("parent_id");
  CREATE INDEX "mod_legal_documents_rels_path_idx" ON "mod_legal_documents_rels" USING btree ("path");
  CREATE INDEX "mod_legal_documents_rels_users_id_idx" ON "mod_legal_documents_rels" USING btree ("users_id");
  CREATE INDEX "_mod_legal_documents_v_parent_idx" ON "_mod_legal_documents_v" USING btree ("parent_id");
  CREATE INDEX "_mod_legal_documents_v_version_version_slug_idx" ON "_mod_legal_documents_v" USING btree ("version_slug");
  CREATE INDEX "_mod_legal_documents_v_version_version_updated_at_idx" ON "_mod_legal_documents_v" USING btree ("version_updated_at");
  CREATE INDEX "_mod_legal_documents_v_version_version_created_at_idx" ON "_mod_legal_documents_v" USING btree ("version_created_at");
  CREATE INDEX "_mod_legal_documents_v_created_at_idx" ON "_mod_legal_documents_v" USING btree ("created_at");
  CREATE INDEX "_mod_legal_documents_v_updated_at_idx" ON "_mod_legal_documents_v" USING btree ("updated_at");
  CREATE INDEX "_mod_legal_documents_v_published_locale_idx" ON "_mod_legal_documents_v" USING btree ("published_locale");
  CREATE INDEX "_mod_legal_documents_v_latest_idx" ON "_mod_legal_documents_v" USING btree ("latest");
  CREATE INDEX "_mod_legal_documents_v_version_version__status_idx" ON "_mod_legal_documents_v_locales" USING btree ("version__status","_locale");
  CREATE UNIQUE INDEX "_mod_legal_documents_v_locales_parent_id_locale_unique" ON "_mod_legal_documents_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_mod_legal_documents_v_rels_order_idx" ON "_mod_legal_documents_v_rels" USING btree ("order");
  CREATE INDEX "_mod_legal_documents_v_rels_parent_idx" ON "_mod_legal_documents_v_rels" USING btree ("parent_id");
  CREATE INDEX "_mod_legal_documents_v_rels_path_idx" ON "_mod_legal_documents_v_rels" USING btree ("path");
  CREATE INDEX "_mod_legal_documents_v_rels_users_id_idx" ON "_mod_legal_documents_v_rels" USING btree ("users_id");
  CREATE INDEX "mod_legal_consents_documents_order_idx" ON "mod_legal_consents_documents" USING btree ("_order");
  CREATE INDEX "mod_legal_consents_documents_parent_id_idx" ON "mod_legal_consents_documents" USING btree ("_parent_id");
  CREATE INDEX "mod_legal_consents_subject_idx" ON "mod_legal_consents" USING btree ("subject");
  CREATE INDEX "mod_legal_consents_updated_at_idx" ON "mod_legal_consents" USING btree ("updated_at");
  CREATE INDEX "mod_legal_consents_created_at_idx" ON "mod_legal_consents" USING btree ("created_at");
  CREATE INDEX "mod_legal_consents_rels_order_idx" ON "mod_legal_consents_rels" USING btree ("order");
  CREATE INDEX "mod_legal_consents_rels_parent_idx" ON "mod_legal_consents_rels" USING btree ("parent_id");
  CREATE INDEX "mod_legal_consents_rels_path_idx" ON "mod_legal_consents_rels" USING btree ("path");
  CREATE INDEX "mod_legal_consents_rels_users_id_idx" ON "mod_legal_consents_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "mod_redirects_rules_from_idx" ON "mod_redirects_rules" USING btree ("from");
  CREATE INDEX "mod_redirects_rules_updated_at_idx" ON "mod_redirects_rules" USING btree ("updated_at");
  CREATE INDEX "mod_redirects_rules_created_at_idx" ON "mod_redirects_rules" USING btree ("created_at");
  CREATE INDEX "mod_redirects_rules_rels_order_idx" ON "mod_redirects_rules_rels" USING btree ("order");
  CREATE INDEX "mod_redirects_rules_rels_parent_idx" ON "mod_redirects_rules_rels" USING btree ("parent_id");
  CREATE INDEX "mod_redirects_rules_rels_path_idx" ON "mod_redirects_rules_rels" USING btree ("path");
  CREATE INDEX "mod_redirects_rules_rels_users_id_idx" ON "mod_redirects_rules_rels" USING btree ("users_id");
  CREATE INDEX "mod_seo_settings_rels_order_idx" ON "mod_seo_settings_rels" USING btree ("order");
  CREATE INDEX "mod_seo_settings_rels_parent_idx" ON "mod_seo_settings_rels" USING btree ("parent_id");
  CREATE INDEX "mod_seo_settings_rels_path_idx" ON "mod_seo_settings_rels" USING btree ("path");
  CREATE INDEX "mod_seo_settings_rels_users_id_idx" ON "mod_seo_settings_rels" USING btree ("users_id");
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_documents_fk" FOREIGN KEY ("mod_legal_documents_id") REFERENCES "public"."mod_legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_consents_fk" FOREIGN KEY ("mod_legal_consents_id") REFERENCES "public"."mod_legal_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_rules_fk" FOREIGN KEY ("mod_redirects_rules_id") REFERENCES "public"."mod_redirects_rules"("id") ON DELETE cascade ON UPDATE no action;
  -- Адреса существующих страниц из цепочки родителей (/uslugi/razrabotka), главная — /.
  WITH RECURSIVE tree AS (
    SELECT id, CASE WHEN slug = 'home' THEN '/' ELSE '/' || slug END AS path
    FROM "pages" WHERE parent_id IS NULL AND slug IS NOT NULL
    UNION ALL
    SELECT p.id, CASE WHEN tree.path = '/' THEN '' ELSE tree.path END || '/' || p.slug
    FROM "pages" p JOIN tree ON p.parent_id = tree.id WHERE p.slug IS NOT NULL
  )
  UPDATE "pages" SET path = tree.path FROM tree WHERE "pages".id = tree.id;
  CREATE UNIQUE INDEX "pages_path_idx" ON "pages" USING btree ("path");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "_pages_v_version_version_path_idx" ON "_pages_v" USING btree ("version_path");
  CREATE INDEX "_pages_v_version_seo_version_seo_og_image_idx" ON "_pages_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "payload_locked_documents_rels_mod_legal_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("mod_legal_documents_id");
  CREATE INDEX "payload_locked_documents_rels_mod_legal_consents_id_idx" ON "payload_locked_documents_rels" USING btree ("mod_legal_consents_id");
  CREATE INDEX "payload_locked_documents_rels_mod_redirects_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("mod_redirects_rules_id");
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mod_legal_documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_legal_documents_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_legal_documents_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_legal_documents_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_legal_documents_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mod_legal_documents_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_legal_consents_documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_legal_consents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_legal_consents_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_redirects_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_redirects_rules_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_seo_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mod_seo_settings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mod_legal_documents" CASCADE;
  DROP TABLE "mod_legal_documents_locales" CASCADE;
  DROP TABLE "mod_legal_documents_rels" CASCADE;
  DROP TABLE "_mod_legal_documents_v" CASCADE;
  DROP TABLE "_mod_legal_documents_v_locales" CASCADE;
  DROP TABLE "_mod_legal_documents_v_rels" CASCADE;
  DROP TABLE "mod_legal_consents_documents" CASCADE;
  DROP TABLE "mod_legal_consents" CASCADE;
  DROP TABLE "mod_legal_consents_rels" CASCADE;
  DROP TABLE "mod_redirects_rules" CASCADE;
  DROP TABLE "mod_redirects_rules_rels" CASCADE;
  DROP TABLE "mod_seo_settings" CASCADE;
  DROP TABLE "mod_seo_settings_rels" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_consents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_redirects_rules_fk";
  
  DROP INDEX "pages_path_idx";
  DROP INDEX "pages_seo_seo_og_image_idx";
  DROP INDEX "_pages_v_version_version_path_idx";
  DROP INDEX "_pages_v_version_seo_version_seo_og_image_idx";
  DROP INDEX "payload_locked_documents_rels_mod_legal_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_mod_legal_consents_id_idx";
  DROP INDEX "payload_locked_documents_rels_mod_redirects_rules_id_idx";
  DROP INDEX "pages_slug_idx";
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  ALTER TABLE "pages" DROP COLUMN "path";
  ALTER TABLE "pages" DROP COLUMN "seo_og_image_id";
  ALTER TABLE "pages" DROP COLUMN "seo_noindex";
  ALTER TABLE "pages" DROP COLUMN "seo_nofollow";
  ALTER TABLE "pages" DROP COLUMN "seo_canonical";
  ALTER TABLE "pages" DROP COLUMN "seo_json_ld";
  ALTER TABLE "pages_locales" DROP COLUMN "seo_title";
  ALTER TABLE "pages_locales" DROP COLUMN "seo_description";
  ALTER TABLE "_pages_v" DROP COLUMN "version_path";
  ALTER TABLE "_pages_v" DROP COLUMN "version_seo_og_image_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_seo_noindex";
  ALTER TABLE "_pages_v" DROP COLUMN "version_seo_nofollow";
  ALTER TABLE "_pages_v" DROP COLUMN "version_seo_canonical";
  ALTER TABLE "_pages_v" DROP COLUMN "version_seo_json_ld";
  ALTER TABLE "_pages_v_locales" DROP COLUMN "version_seo_title";
  ALTER TABLE "_pages_v_locales" DROP COLUMN "version_seo_description";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mod_legal_documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mod_legal_consents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mod_redirects_rules_id";
  DROP TYPE "public"."enum_mod_legal_documents_kind";
  DROP TYPE "public"."enum_mod_legal_documents_status";
  DROP TYPE "public"."enum__mod_legal_documents_v_version_kind";
  DROP TYPE "public"."enum__mod_legal_documents_v_published_locale";
  DROP TYPE "public"."enum__mod_legal_documents_v_version_status";
  DROP TYPE "public"."enum_mod_redirects_rules_code";
  DROP TYPE "public"."enum_mod_redirects_rules_source";
  DROP TYPE "public"."enum_mod_seo_settings_sitemap_changefreq";`)
}
