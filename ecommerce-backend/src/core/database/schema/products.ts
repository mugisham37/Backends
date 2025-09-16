/**
 * Product schema definition
 * Defines the products table structure with inventory and pricing information
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  decimal,
  integer,
  boolean,
  json,
} from "drizzle-orm/pg-core";

// Product status enum
export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "inactive",
  "out_of_stock",
  "discontinued",
]);

// Product condition enum
export const productConditionEnum = pgEnum("product_condition", [
  "new",
  "used",
  "refurbished",
]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull(), // References vendors.id
  categoryId: uuid("category_id"), // References categories.id

  // Basic information
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  shortDescription: text("short_description"),

  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),

  // Inventory
  sku: varchar("sku", { length: 100 }).unique(),
  barcode: varchar("barcode", { length: 100 }),
  trackQuantity: boolean("track_quantity").default(true),
  quantity: integer("quantity").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),

  // Physical properties
  weight: decimal("weight", { precision: 8, scale: 2 }),
  weightUnit: varchar("weight_unit", { length: 10 }).default("kg"),
  dimensions: json("dimensions").$type<{
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  }>(),

  // Status and visibility
  status: productStatusEnum("status").default("draft").notNull(),
  condition: productConditionEnum("condition").default("new"),
  featured: boolean("featured").default(false),

  // Media
  images: json("images").$type<string[]>().default([]),

  // SEO
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),

  // Product attributes
  attributes: json("attributes").$type<{
    [key: string]: string | number | boolean;
  }>(),

  // Variants (for products with multiple options)
  hasVariants: boolean("has_variants").default(false),

  // Shipping
  requiresShipping: boolean("requires_shipping").default(true),
  shippingClass: varchar("shipping_class", { length: 100 }),

  // Tax
  taxable: boolean("taxable").default(true),
  taxClass: varchar("tax_class", { length: 100 }),

  // Timestamps
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"), // Self-reference for hierarchical categories

  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),

  // Display
  image: varchar("image", { length: 500 }),
  icon: varchar("icon", { length: 100 }),
  color: varchar("color", { length: 7 }),

  // SEO
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),

  // Settings
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product variants (for products with multiple options like size, color)
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull(), // References products.id

  // Variant information
  title: varchar("title", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).unique(),
  barcode: varchar("barcode", { length: 100 }),

  // Pricing (can override product pricing)
  price: decimal("price", { precision: 10, scale: 2 }),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),

  // Inventory
  quantity: integer("quantity").default(0),

  // Physical properties
  weight: decimal("weight", { precision: 8, scale: 2 }),

  // Variant options (e.g., {"size": "L", "color": "red"})
  options: json("options").$type<{
    [key: string]: string;
  }>(),

  // Media
  image: varchar("image", { length: 500 }),

  // Status
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
