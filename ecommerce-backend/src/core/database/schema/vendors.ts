/**
 * Vendor schema definition
 * Defines the vendors table structure with business information and relationships
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  decimal,
  boolean,
  json,
} from "drizzle-orm/pg-core";

// Vendor status enum
export const vendorStatusEnum = pgEnum("vendor_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "inactive",
]);

// Vendor verification status enum
export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // References users.id

  // Business information
  businessName: varchar("business_name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  businessType: varchar("business_type", { length: 100 }),

  // Contact information
  email: varchar("email", { length: 255 }).notNull().unique(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  website: varchar("website", { length: 255 }),

  // Business details
  taxId: varchar("tax_id", { length: 50 }),
  businessLicense: varchar("business_license", { length: 100 }),

  // Status and verification
  status: vendorStatusEnum("status").default("pending").notNull(),
  verificationStatus: verificationStatusEnum("verification_status")
    .default("unverified")
    .notNull(),

  // Financial information
  commissionRate: decimal("commission_rate", {
    precision: 5,
    scale: 2,
  }).default("10.00"),

  // Settings
  autoApproveProducts: boolean("auto_approve_products").default(false),
  allowReviews: boolean("allow_reviews").default(true),

  // Metadata
  metadata: json("metadata").$type<{
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
    businessHours?: {
      [key: string]: {
        open: string;
        close: string;
        closed: boolean;
      };
    };
    shippingPolicies?: string;
    returnPolicy?: string;
  }>(),

  // Timestamps
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
