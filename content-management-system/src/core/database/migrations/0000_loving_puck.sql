CREATE TABLE IF NOT EXISTS "user_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"conditions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"refresh_token_hash" varchar(255),
	"device_info" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"display_name" varchar(200),
	"avatar" text,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires_at" timestamp,
	"last_login_at" timestamp,
	"tenant_id" uuid NOT NULL,
	"preferences" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"tenant_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"tenant_id" uuid NOT NULL,
	"usage_count" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text,
	"excerpt" text,
	"status" varchar(20) NOT NULL,
	"author_id" uuid,
	"change_log" text,
	"custom_fields" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"body" text,
	"content_type" varchar(50) DEFAULT 'article' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_latest_version" boolean DEFAULT true NOT NULL,
	"parent_id" uuid,
	"original_id" uuid,
	"published_at" timestamp,
	"scheduled_at" timestamp,
	"author_id" uuid,
	"editor_id" uuid,
	"tenant_id" uuid NOT NULL,
	"seo_title" varchar(255),
	"seo_description" text,
	"seo_keywords" varchar(500),
	"featured_image" text,
	"tags" jsonb,
	"categories" jsonb,
	"custom_fields" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"media_type" varchar(20) NOT NULL,
	"size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration" integer,
	"hash" varchar(64),
	"path" text NOT NULL,
	"url" text,
	"cdn_url" text,
	"storage_provider" varchar(20) DEFAULT 'local' NOT NULL,
	"bucket" varchar(100),
	"key" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT true NOT NULL,
	"processing_status" varchar(20) DEFAULT 'completed' NOT NULL,
	"uploader_id" uuid,
	"tenant_id" uuid NOT NULL,
	"folder_id" uuid,
	"alt" text,
	"caption" text,
	"description" text,
	"tags" jsonb,
	"exif_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"tenant_id" uuid NOT NULL,
	"path" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_transformations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"width" integer,
	"height" integer,
	"quality" integer,
	"format" varchar(10),
	"size" bigint NOT NULL,
	"path" text NOT NULL,
	"url" text,
	"cdn_url" text,
	"transformations" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" varchar(100),
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"domain" varchar(255),
	"subdomain" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_user_resource_idx" ON "user_permissions" ("user_id","resource");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_resource_action_idx" ON "user_permissions" ("resource","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "user_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_token_idx" ON "user_sessions" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_refresh_token_idx" ON "user_sessions" ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_active_idx" ON "user_sessions" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_expires_idx" ON "user_sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tenant_idx" ON "users" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "users" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_active_idx" ON "users" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_last_login_idx" ON "users" ("last_login_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_slug_tenant_idx" ON "content_categories" ("slug","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_parent_idx" ON "content_categories" ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_tenant_idx" ON "content_categories" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_active_idx" ON "content_categories" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tag_slug_tenant_idx" ON "content_tags" ("slug","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tag_name_idx" ON "content_tags" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tag_tenant_idx" ON "content_tags" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tag_usage_idx" ON "content_tags" ("usage_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "version_content_version_idx" ON "content_versions" ("content_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "version_content_idx" ON "content_versions" ("content_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "version_author_idx" ON "content_versions" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "version_created_idx" ON "content_versions" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_slug_tenant_idx" ON "contents" ("slug","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_status_idx" ON "contents" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_type_idx" ON "contents" ("content_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_author_idx" ON "contents" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_tenant_idx" ON "contents" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_published_idx" ON "contents" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_scheduled_idx" ON "contents" ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_version_idx" ON "contents" ("original_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_latest_version_idx" ON "contents" ("is_latest_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_parent_idx" ON "contents" ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_filename_idx" ON "media" ("filename");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_mime_type_idx" ON "media" ("mime_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_type_idx" ON "media" ("media_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_hash_idx" ON "media" ("hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_uploader_idx" ON "media" ("uploader_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_tenant_idx" ON "media" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_folder_idx" ON "media" ("folder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_public_idx" ON "media" ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_processed_idx" ON "media" ("is_processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_created_idx" ON "media" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_slug_tenant_idx" ON "media_folders" ("slug","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_parent_idx" ON "media_folders" ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_tenant_idx" ON "media_folders" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_path_idx" ON "media_folders" ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_public_idx" ON "media_folders" ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transformation_media_name_idx" ON "media_transformations" ("media_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transformation_media_idx" ON "media_transformations" ("media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transformation_name_idx" ON "media_transformations" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_media_idx" ON "media_usage" ("media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_entity_idx" ON "media_usage" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_media_entity_idx" ON "media_usage" ("media_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_slug_idx" ON "tenants" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_domain_idx" ON "tenants" ("domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_subdomain_idx" ON "tenants" ("subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_active_idx" ON "tenants" ("is_active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_categories" ADD CONSTRAINT "content_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contents" ADD CONSTRAINT "contents_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contents" ADD CONSTRAINT "contents_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contents" ADD CONSTRAINT "contents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_transformations" ADD CONSTRAINT "media_transformations_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_usage" ADD CONSTRAINT "media_usage_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
