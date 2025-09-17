DO $$ BEGIN
 CREATE TYPE "analytics_event_type" AS ENUM('page_view', 'user_action', 'transaction', 'product_view', 'search', 'cart_action', 'checkout_step', 'conversion', 'error', 'performance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('customer', 'vendor', 'admin', 'moderator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_status" AS ENUM('active', 'inactive', 'suspended', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vendor_status" AS ENUM('pending', 'approved', 'rejected', 'suspended', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "product_condition" AS ENUM('new', 'used', 'refurbished');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "product_status" AS ENUM('draft', 'active', 'inactive', 'out_of_stock', 'discontinued');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "shipping_status" AS ENUM('pending', 'processing', 'shipped', 'in_transit', 'delivered', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_channel" AS ENUM('in_app', 'email', 'sms', 'push', 'webhook');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_priority" AS ENUM('low', 'normal', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_type" AS ENUM('order_created', 'order_updated', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_received', 'payment_failed', 'product_approved', 'product_rejected', 'vendor_approved', 'vendor_rejected', 'payout_processed', 'review_received', 'system_alert', 'security_alert', 'welcome', 'password_reset', 'email_verification', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "delivery_status" AS ENUM('pending', 'success', 'failed', 'retrying', 'timeout', 'invalid_response');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "http_method" AS ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "webhook_event_type" AS ENUM('order.created', 'order.updated', 'order.cancelled', 'order.fulfilled', 'payment.succeeded', 'payment.failed', 'product.created', 'product.updated', 'product.deleted', 'user.created', 'user.updated', 'vendor.approved', 'vendor.rejected', 'notification.sent', 'system.error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "webhook_status" AS ENUM('active', 'inactive', 'failed', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "analytics_event_type" NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"event_category" varchar(50),
	"user_id" uuid,
	"session_id" varchar(100),
	"visitor_id" varchar(100),
	"properties" json,
	"value" numeric(10, 2),
	"quantity" integer,
	"user_agent" text,
	"ip_address" varchar(45),
	"referrer" text,
	"utm" json,
	"country" varchar(2),
	"region" varchar(100),
	"city" varchar(100),
	"device" varchar(50),
	"browser" varchar(50),
	"os" varchar(50),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"metric_type" varchar(50) NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"previous_value" numeric(15, 2),
	"percentage_change" numeric(5, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"segment" varchar(100),
	"metadata" json,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"vendor_id" uuid,
	"date" timestamp NOT NULL,
	"period" varchar(20) NOT NULL,
	"views" integer DEFAULT 0,
	"unique_views" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"add_to_cart" integer DEFAULT 0,
	"add_to_wishlist" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"reviews" integer DEFAULT 0,
	"average_rating" numeric(3, 2),
	"purchases" integer DEFAULT 0,
	"revenue" numeric(10, 2) DEFAULT '0.00',
	"conversion_rate" numeric(5, 2),
	"bounce_rate" numeric(5, 2),
	"average_time_spent" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_behavior_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(100) NOT NULL,
	"session_start" timestamp NOT NULL,
	"session_end" timestamp,
	"session_duration" integer,
	"page_views" integer DEFAULT 0,
	"bounce_rate" numeric(5, 2),
	"conversion_events" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"scroll_depth" numeric(5, 2),
	"time_on_site" integer,
	"entry_page" text,
	"exit_page" text,
	"page_sequence" json,
	"device" varchar(50),
	"browser" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"phone_number" varchar(20),
	"date_of_birth" timestamp,
	"bio" text,
	"avatar" varchar(500),
	"language" varchar(5) DEFAULT 'en',
	"timezone" varchar(50) DEFAULT 'UTC',
	"email_notifications" boolean DEFAULT true,
	"sms_notifications" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"business_type" varchar(100),
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(20),
	"website" varchar(255),
	"tax_id" varchar(50),
	"business_license" varchar(100),
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '10.00',
	"auto_approve_products" boolean DEFAULT false,
	"allow_reviews" boolean DEFAULT true,
	"metadata" json,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_slug_unique" UNIQUE("slug"),
	CONSTRAINT "vendors_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"image" varchar(500),
	"icon" varchar(100),
	"color" varchar(7),
	"meta_title" varchar(255),
	"meta_description" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"sku" varchar(100),
	"barcode" varchar(100),
	"price" numeric(10, 2),
	"compare_at_price" numeric(10, 2),
	"cost_price" numeric(10, 2),
	"quantity" integer DEFAULT 0,
	"weight" numeric(8, 2),
	"options" json,
	"image" varchar(500),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"short_description" text,
	"price" numeric(10, 2) NOT NULL,
	"compare_at_price" numeric(10, 2),
	"cost_price" numeric(10, 2),
	"sku" varchar(100),
	"barcode" varchar(100),
	"track_quantity" boolean DEFAULT true,
	"quantity" integer DEFAULT 0,
	"low_stock_threshold" integer DEFAULT 5,
	"weight" numeric(8, 2),
	"weight_unit" varchar(10) DEFAULT 'kg',
	"dimensions" json,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"condition" "product_condition" DEFAULT 'new',
	"featured" boolean DEFAULT false,
	"images" json DEFAULT '[]'::json,
	"meta_title" varchar(255),
	"meta_description" text,
	"attributes" json,
	"has_variants" boolean DEFAULT false,
	"requires_shipping" boolean DEFAULT true,
	"shipping_class" varchar(100),
	"taxable" boolean DEFAULT true,
	"tax_class" varchar(100),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"vendor_id" uuid NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_sku" varchar(100),
	"variant_title" varchar(255),
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"product_snapshot" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"user_id" uuid,
	"customer_email" varchar(255) NOT NULL,
	"customer_phone" varchar(20),
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"shipping_status" "shipping_status" DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0.00',
	"shipping_amount" numeric(10, 2) DEFAULT '0.00',
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"billing_address" json NOT NULL,
	"shipping_address" json NOT NULL,
	"shipping_method" varchar(100),
	"tracking_number" varchar(100),
	"tracking_url" varchar(500),
	"customer_notes" text,
	"admin_notes" text,
	"metadata" json,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"payment_intent_id" varchar(255),
	"transaction_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"gateway_response" json,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"quiet_hours_timezone" varchar(50) DEFAULT 'UTC',
	"daily_digest_enabled" boolean DEFAULT false NOT NULL,
	"weekly_digest_enabled" boolean DEFAULT false NOT NULL,
	"digest_time" varchar(5) DEFAULT '09:00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"language" varchar(5) DEFAULT 'en' NOT NULL,
	"subject" varchar(255),
	"template" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"category" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"delivered_at" timestamp,
	"delivered_channels" jsonb DEFAULT '[]'::jsonb,
	"scheduled_for" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_endpoint_id" uuid NOT NULL,
	"webhook_event_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"request_url" text NOT NULL,
	"request_method" varchar(10) NOT NULL,
	"request_headers" json,
	"request_body" text,
	"response_status" integer,
	"response_headers" json,
	"response_body" text,
	"response_time" integer,
	"error_message" text,
	"error_code" varchar(50),
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"http_method" "http_method" DEFAULT 'POST' NOT NULL,
	"secret" varchar(255),
	"content_type" varchar(50) DEFAULT 'application/json',
	"status" "webhook_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true,
	"max_retries" integer DEFAULT 3,
	"timeout_seconds" integer DEFAULT 30,
	"event_types" json NOT NULL,
	"filters" json,
	"headers" json,
	"auth_type" varchar(20),
	"auth_credentials" json,
	"user_id" uuid,
	"vendor_id" uuid,
	"total_deliveries" integer DEFAULT 0,
	"successful_deliveries" integer DEFAULT 0,
	"failed_deliveries" integer DEFAULT 0,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "webhook_event_type" NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"payload" json NOT NULL,
	"metadata" json,
	"source_id" varchar(100),
	"source_type" varchar(50),
	"user_id" uuid,
	"vendor_id" uuid,
	"is_processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_endpoint_id" uuid,
	"webhook_delivery_id" uuid,
	"log_level" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"context" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_endpoint_id" uuid NOT NULL,
	"event_type" "webhook_event_type" NOT NULL,
	"is_active" boolean DEFAULT true,
	"filters" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_type" ON "analytics_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_user_id" ON "analytics_events" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_session_id" ON "analytics_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_timestamp" ON "analytics_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_name" ON "analytics_events" ("event_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_business_metrics_name" ON "business_metrics" ("metric_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_business_metrics_period" ON "business_metrics" ("period","period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_business_metrics_segment" ON "business_metrics" ("segment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_analytics_product_id" ON "product_analytics" ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_analytics_vendor_id" ON "product_analytics" ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_analytics_date" ON "product_analytics" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_analytics_period" ON "product_analytics" ("period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_behavior_user_id" ON "user_behavior_analytics" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_behavior_session_id" ON "user_behavior_analytics" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_behavior_session_start" ON "user_behavior_analytics" ("session_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_endpoint_id" ON "webhook_deliveries" ("webhook_endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_event_id" ON "webhook_deliveries" ("webhook_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_status" ON "webhook_deliveries" ("delivery_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_scheduled_at" ON "webhook_deliveries" ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_next_retry_at" ON "webhook_deliveries" ("next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_endpoints_status" ON "webhook_endpoints" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_endpoints_user_id" ON "webhook_endpoints" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_endpoints_vendor_id" ON "webhook_endpoints" ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_event_type" ON "webhook_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_event_id" ON "webhook_events" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_is_processed" ON "webhook_events" ("is_processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_source_id" ON "webhook_events" ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_created_at" ON "webhook_events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_logs_endpoint_id" ON "webhook_logs" ("webhook_endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_logs_delivery_id" ON "webhook_logs" ("webhook_delivery_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_logs_log_level" ON "webhook_logs" ("log_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_logs_created_at" ON "webhook_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_subscriptions_endpoint_id" ON "webhook_subscriptions" ("webhook_endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_subscriptions_event_type" ON "webhook_subscriptions" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_subscriptions_is_active" ON "webhook_subscriptions" ("is_active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
