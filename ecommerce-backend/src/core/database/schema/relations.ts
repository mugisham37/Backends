/**
 * Database relations definition
 * Defines all foreign key relationships between tables
 */

import { relations } from "drizzle-orm";
import { users } from "./users";
import { vendors } from "./vendors";
import { products, categories, productVariants } from "./products";
import { orders, orderItems } from "./orders";
import { carts, cartItems, cartSavedItems } from "./cart";
import {
  payments,
  paymentTransactions,
  paymentRefunds,
  paymentWebhooks,
  paymentDisputes,
} from "./payments";

// User relations
export const usersRelations = relations(users, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [users.id],
    references: [vendors.userId],
  }),
  orders: many(orders),
  carts: many(carts),
}));

// Vendor relations
export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, {
    fields: [vendors.userId],
    references: [users.id],
  }),
  products: many(products),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
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
  cartItems: many(cartItems),
  cartSavedItems: many(cartSavedItems),
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
    cartItems: many(cartItems),
    cartSavedItems: many(cartSavedItems),
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
  paymentRefunds: many(paymentRefunds),
  paymentDisputes: many(paymentDisputes),
  convertedFromCart: one(carts, {
    fields: [orders.id],
    references: [carts.convertedOrderId],
  }),
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

// Cart relations
export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, {
    fields: [carts.userId],
    references: [users.id],
  }),
  cartItems: many(cartItems),
  cartSavedItems: many(cartSavedItems),
  convertedOrder: one(orders, {
    fields: [carts.convertedOrderId],
    references: [orders.id],
  }),
}));

// Cart item relations
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
  vendor: one(vendors, {
    fields: [cartItems.vendorId],
    references: [vendors.id],
  }),
}));

// Cart saved item relations
export const cartSavedItemsRelations = relations(cartSavedItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartSavedItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartSavedItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartSavedItems.variantId],
    references: [productVariants.id],
  }),
  vendor: one(vendors, {
    fields: [cartSavedItems.vendorId],
    references: [vendors.id],
  }),
  originalCartItem: one(cartItems, {
    fields: [cartSavedItems.originalCartItemId],
    references: [cartItems.id],
  }),
}));

// Payment relations
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  transactions: many(paymentTransactions),
  refunds: many(paymentRefunds),
  webhooks: many(paymentWebhooks),
  disputes: many(paymentDisputes),
}));

// Payment transaction relations
export const paymentTransactionsRelations = relations(
  paymentTransactions,
  ({ one }) => ({
    payment: one(payments, {
      fields: [paymentTransactions.paymentId],
      references: [payments.id],
    }),
  })
);

// Payment refund relations
export const paymentRefundsRelations = relations(paymentRefunds, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentRefunds.paymentId],
    references: [payments.id],
  }),
  order: one(orders, {
    fields: [paymentRefunds.orderId],
    references: [orders.id],
  }),
  processedByUser: one(users, {
    fields: [paymentRefunds.processedByUserId],
    references: [users.id],
  }),
}));

// Payment webhook relations
export const paymentWebhooksRelations = relations(
  paymentWebhooks,
  ({ one }) => ({
    payment: one(payments, {
      fields: [paymentWebhooks.paymentId],
      references: [payments.id],
    }),
    order: one(orders, {
      fields: [paymentWebhooks.orderId],
      references: [orders.id],
    }),
  })
);

// Payment dispute relations
export const paymentDisputesRelations = relations(
  paymentDisputes,
  ({ one }) => ({
    payment: one(payments, {
      fields: [paymentDisputes.paymentId],
      references: [payments.id],
    }),
    order: one(orders, {
      fields: [paymentDisputes.orderId],
      references: [orders.id],
    }),
  })
);
