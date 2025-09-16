/**
 * Database relations definition
 * Defines all foreign key relationships between tables
 */

import { relations } from "drizzle-orm";
import { users } from "./users";
import { vendors } from "./vendors";
import { products, categories, productVariants } from "./products";
import { orders, orderItems, payments } from "./orders";

// User relations
export const usersRelations = relations(users, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [users.id],
    references: [vendors.userId],
  }),
  orders: many(orders),
}));

// Vendor relations
export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, {
    fields: [vendors.userId],
    references: [users.id],
  }),
  products: many(products),
  orderItems: many(orderItems),
}));

// Category relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  products: many(products),
}));

// Product relations
export const productsRelations = relations(products, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [products.vendorId],
    references: [vendors.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  orderItems: many(orderItems),
}));

// Product variant relations
export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    orderItems: many(orderItems),
  })
);

// Order relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  orderItems: many(orderItems),
  payments: many(payments),
}));

// Order item relations
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  vendor: one(vendors, {
    fields: [orderItems.vendorId],
    references: [vendors.id],
  }),
}));

// Payment relations
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));
