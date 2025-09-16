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
