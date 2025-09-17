/**
 * Cart schema definition
 * Defines the cart and cart items table structure for shopping cart functionality
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

// Cart status enum
export const cartStatusEnum = pgEnum("cart_status", [
  "active",
  "abandoned",
  "converted",
  "expired",
]);

// Cart type enum
export const cartTypeEnum = pgEnum("cart_type", [
  "shopping",
  "wishlist",
  "saved_for_later",
]);

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),

  // User information (null for guest carts)
  userId: uuid("user_id"), // References users.id
  sessionId: varchar("session_id", { length: 255 }), // For guest carts

  // Cart properties
  type: cartTypeEnum("type").default("shopping").notNull(),
  status: cartStatusEnum("status").default("active").notNull(),

  // Currency and totals
  currency: varchar("currency", { length: 3 }).default("USD"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  shippingAmount: decimal("shipping_amount", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00"),

  // Applied discounts and coupons
  appliedCoupons: json("applied_coupons")
    .$type<
      Array<{
        code: string;
        discountAmount: number;
        discountType: "percentage" | "fixed";
        appliedAt: string;
      }>
    >()
    .default([]),

  // Shipping information
  shippingAddress: json("shipping_address").$type<{
    firstName?: string;
    lastName?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  }>(),

  shippingMethod: varchar("shipping_method", { length: 100 }),
  shippingRate: decimal("shipping_rate", { precision: 10, scale: 2 }),

  // Customer information for guest carts
  customerEmail: varchar("customer_email", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 20 }),

  // Cart notes and metadata
  notes: text("notes"),
  metadata: json("metadata").$type<{
    source?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
    };
    device?: string;
    browserInfo?: any;
    [key: string]: any;
  }>(),

  // Cart expiration and conversion tracking
  expiresAt: timestamp("expires_at"),
  convertedOrderId: uuid("converted_order_id"), // References orders.id
  convertedAt: timestamp("converted_at"),

  // Timestamps
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").notNull(), // References carts.id

  // Product information
  productId: uuid("product_id").notNull(), // References products.id
  variantId: uuid("variant_id"), // References product_variants.id
  vendorId: uuid("vendor_id").notNull(), // References vendors.id

  // Product snapshot (at time of adding to cart)
  productName: varchar("product_name", { length: 255 }).notNull(),
  productSlug: varchar("product_slug", { length: 255 }),
  productSku: varchar("product_sku", { length: 100 }),
  variantTitle: varchar("variant_title", { length: 255 }),
  productImage: varchar("product_image", { length: 500 }),

  // Pricing (snapshot at time of adding)
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),

  // Quantity and calculations
  quantity: integer("quantity").notNull().default(1),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),

  // Product attributes and customizations
  selectedAttributes: json("selected_attributes").$type<{
    [key: string]: string | number;
  }>(),

  customizations: json("customizations").$type<{
    personalizedText?: string;
    giftWrap?: boolean;
    giftMessage?: string;
    deliveryInstructions?: string;
    [key: string]: any;
  }>(),

  // Product availability snapshot
  productSnapshot: json("product_snapshot").$type<{
    name: string;
    description?: string;
    image?: string;
    attributes?: { [key: string]: any };
    vendor?: {
      id: string;
      name: string;
      businessName: string;
    };
    availability?: {
      inStock: boolean;
      quantity: number;
      lowStockThreshold: number;
    };
  }>(),

  // Item notes
  notes: text("notes"),

  // Timestamps
  addedAt: timestamp("added_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cart saved items (for save for later functionality)
export const cartSavedItems = pgTable("cart_saved_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").notNull(), // References carts.id

  // Original cart item reference
  originalCartItemId: uuid("original_cart_item_id"), // References cart_items.id

  // Product information (same as cart items)
  productId: uuid("product_id").notNull(),
  variantId: uuid("variant_id"),
  vendorId: uuid("vendor_id").notNull(),

  // Product snapshot
  productName: varchar("product_name", { length: 255 }).notNull(),
  productSlug: varchar("product_slug", { length: 255 }),
  productSku: varchar("product_sku", { length: 100 }),
  variantTitle: varchar("variant_title", { length: 255 }),
  productImage: varchar("product_image", { length: 500 }),

  // Saved item properties
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  selectedAttributes: json("selected_attributes").$type<{
    [key: string]: string | number;
  }>(),

  productSnapshot: json("product_snapshot").$type<{
    [key: string]: any;
  }>(),

  // Save details
  savedReason: varchar("saved_reason", { length: 100 }), // "price_too_high", "out_of_stock", "compare_later", etc.
  notes: text("notes"),

  // Timestamps
  savedAt: timestamp("saved_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type CartSavedItem = typeof cartSavedItems.$inferSelect;
export type NewCartSavedItem = typeof cartSavedItems.$inferInsert;
