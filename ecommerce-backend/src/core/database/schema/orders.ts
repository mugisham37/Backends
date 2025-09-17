/**
 * Order schema definition
 * Defines the orders and order items table structure with payment and shipping information
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

// Order status enum
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "returned",
]);

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

// Shipping status enum
export const shippingStatusEnum = pgEnum("shipping_status", [
  "pending",
  "processing",
  "shipped",
  "in_transit",
  "delivered",
  "failed",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),

  // Customer information
  userId: uuid("user_id"), // References users.id (null for guest orders)
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }),

  // Order status
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentStatus: paymentStatusEnum("payment_status")
    .default("pending")
    .notNull(),
  shippingStatus: shippingStatusEnum("shipping_status")
    .default("pending")
    .notNull(),

  // Pricing
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  shippingAmount: decimal("shipping_amount", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),

  // Currency
  currency: varchar("currency", { length: 3 }).default("USD"),

  // Addresses
  billingAddress: json("billing_address")
    .$type<{
      firstName: string;
      lastName: string;
      company?: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
    }>()
    .notNull(),

  shippingAddress: json("shipping_address")
    .$type<{
      firstName: string;
      lastName: string;
      company?: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
    }>()
    .notNull(),

  // Shipping information
  shippingMethod: varchar("shipping_method", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  trackingUrl: varchar("tracking_url", { length: 500 }),

  // Notes
  customerNotes: text("customer_notes"),
  adminNotes: text("admin_notes"),

  // Metadata
  metadata: json("metadata").$type<{
    source?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
    };
    [key: string]: any;
  }>(),

  // Timestamps
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(), // References orders.id
  productId: uuid("product_id").notNull(), // References products.id
  variantId: uuid("variant_id"), // References product_variants.id
  vendorId: uuid("vendor_id").notNull(), // References vendors.id

  // Product information (snapshot at time of order)
  productName: varchar("product_name", { length: 255 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantTitle: varchar("variant_title", { length: 255 }),

  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),

  // Product snapshot
  productSnapshot: json("product_snapshot").$type<{
    name: string;
    description?: string;
    image?: string;
    attributes?: { [key: string]: any };
  }>(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
