/**
 * Enhanced Payments schema definition
 * Defines comprehensive payment processing, transactions, and refunds structure
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

// Payment method enum
export const paymentMethodEnum = pgEnum("payment_method", [
  "stripe",
  "paypal",
  "square",
  "bank_transfer",
  "cash_on_delivery",
  "store_credit",
  "gift_card",
  "cryptocurrency",
  "apple_pay",
  "google_pay",
  "klarna",
  "afterpay",
]);

// Payment status enum (enhanced from orders.ts)
export const paymentsStatusEnum = pgEnum("payments_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "disputed",
  "requires_action",
  "requires_confirmation",
]);

// Transaction type enum
export const transactionTypeEnum = pgEnum("transaction_type", [
  "payment",
  "refund",
  "partial_refund",
  "chargeback",
  "dispute",
  "payout",
  "fee",
  "adjustment",
]);

// Payment provider enum
export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "paypal",
  "square",
  "braintree",
  "adyen",
  "authorize_net",
  "coinbase",
  "internal",
]);

// Enhanced payments table
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Order relationship
  orderId: uuid("order_id").notNull(), // References orders.id
  vendorId: uuid("vendor_id").notNull(), // References vendors.id

  // Payment identification
  paymentNumber: varchar("payment_number", { length: 50 }).notNull().unique(),
  externalId: varchar("external_id", { length: 255 }), // Provider's payment ID

  // Payment details
  method: paymentMethodEnum("method").notNull(),
  provider: paymentProviderEnum("provider").notNull(),
  status: paymentsStatusEnum("status").default("pending").notNull(),

  // Amounts
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),

  // Fee information
  providerFee: decimal("provider_fee", { precision: 10, scale: 2 }).default(
    "0.00"
  ),
  applicationFee: decimal("application_fee", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(),

  // Payment method specific data
  cardInfo: json("card_info").$type<{
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
    fingerprint?: string;
    funding?: string;
    country?: string;
  }>(),

  bankInfo: json("bank_info").$type<{
    accountType?: string;
    bankName?: string;
    routingNumber?: string;
    last4?: string;
    country?: string;
  }>(),

  walletInfo: json("wallet_info").$type<{
    type?: string; // apple_pay, google_pay, etc.
    fingerprint?: string;
  }>(),

  // Billing information
  billingAddress: json("billing_address").$type<{
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

  // Provider response data
  providerResponse: json("provider_response").$type<{
    [key: string]: any;
  }>(),

  // Payment intent and confirmation
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  clientSecret: varchar("client_secret", { length: 255 }),
  confirmationMethod: varchar("confirmation_method", { length: 50 }),

  // Risk and fraud assessment
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  riskLevel: varchar("risk_level", { length: 20 }), // low, medium, high
  fraudDetection: json("fraud_detection").$type<{
    provider?: string;
    score?: number;
    decision?: string;
    rules?: Array<{
      name: string;
      decision: string;
      score: number;
    }>;
  }>(),

  // Processing information
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: varchar("failure_reason", { length: 255 }),
  failureCode: varchar("failure_code", { length: 50 }),

  // Metadata and tracking
  metadata: json("metadata").$type<{
    customerIp?: string;
    userAgent?: string;
    sessionId?: string;
    correlationId?: string;
    [key: string]: any;
  }>(),

  // Refund information
  refundedAmount: decimal("refunded_amount", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  refundableAmount: decimal("refundable_amount", { precision: 10, scale: 2 }),

  // Dispute information
  disputedAmount: decimal("disputed_amount", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  disputeReason: varchar("dispute_reason", { length: 100 }),

  // Settlement information
  settledAt: timestamp("settled_at"),
  settlementId: varchar("settlement_id", { length: 255 }),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment transactions (for detailed transaction history)
export const paymentTransactions = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Payment relationship
  paymentId: uuid("payment_id").notNull(), // References payments.id

  // Transaction details
  transactionNumber: varchar("transaction_number", { length: 50 })
    .notNull()
    .unique(),
  type: transactionTypeEnum("type").notNull(),
  status: paymentsStatusEnum("status").default("pending").notNull(),

  // Amounts
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),

  // Provider information
  externalTransactionId: varchar("external_transaction_id", { length: 255 }),
  providerResponse: json("provider_response").$type<{
    [key: string]: any;
  }>(),

  // Transaction details
  reason: varchar("reason", { length: 255 }),
  description: text("description"),

  // Processing information
  processedAt: timestamp("processed_at"),

  // Metadata
  metadata: json("metadata").$type<{
    [key: string]: any;
  }>(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment refunds
export const paymentRefunds = pgTable("payment_refunds", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Payment relationship
  paymentId: uuid("payment_id").notNull(), // References payments.id
  orderId: uuid("order_id").notNull(), // References orders.id

  // Refund identification
  refundNumber: varchar("refund_number", { length: 50 }).notNull().unique(),
  externalRefundId: varchar("external_refund_id", { length: 255 }),

  // Refund details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  reason: varchar("reason", { length: 100 }).notNull(),
  status: paymentsStatusEnum("status").default("pending").notNull(),

  // Refund type
  type: varchar("type", { length: 20 }).default("requested"), // requested, automatic, chargeback

  // Processing information
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: varchar("failure_reason", { length: 255 }),

  // Provider response
  providerResponse: json("provider_response").$type<{
    [key: string]: any;
  }>(),

  // Refund items (for partial refunds)
  refundItems: json("refund_items").$type<
    Array<{
      orderItemId: string;
      productId: string;
      productName: string;
      quantity: number;
      amount: number;
      reason?: string;
    }>
  >(),

  // Admin information
  processedByUserId: uuid("processed_by_user_id"), // References users.id (admin who processed)
  adminNotes: text("admin_notes"),

  // Customer information
  customerNotified: boolean("customer_notified").default(false),
  customerNotificationSentAt: timestamp("customer_notification_sent_at"),

  // Metadata
  metadata: json("metadata").$type<{
    [key: string]: any;
  }>(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment webhooks (for tracking webhook events)
export const paymentWebhooks = pgTable("payment_webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Webhook identification
  webhookEventId: varchar("webhook_event_id", { length: 255 })
    .notNull()
    .unique(),
  provider: paymentProviderEnum("provider").notNull(),

  // Event details
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventData: json("event_data").notNull(),

  // Processing status
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  processingAttempts: integer("processing_attempts").default(0),
  lastProcessingError: text("last_processing_error"),

  // Related entities
  paymentId: uuid("payment_id"), // References payments.id
  orderId: uuid("order_id"), // References orders.id

  // Verification
  verified: boolean("verified").default(false),
  signature: varchar("signature", { length: 500 }),

  // Metadata
  metadata: json("metadata").$type<{
    source?: string;
    version?: string;
    [key: string]: any;
  }>(),

  // Timestamps
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment disputes
export const paymentDisputes = pgTable("payment_disputes", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Payment and order relationship
  paymentId: uuid("payment_id").notNull(), // References payments.id
  orderId: uuid("order_id").notNull(), // References orders.id

  // Dispute identification
  disputeId: varchar("dispute_id", { length: 255 }).notNull().unique(),
  externalDisputeId: varchar("external_dispute_id", { length: 255 }),

  // Dispute details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  reason: varchar("reason", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),

  // Dispute information
  evidenceDueBy: timestamp("evidence_due_by"),
  isChargeback: boolean("is_chargeback").default(false),

  // Evidence and response
  evidence: json("evidence").$type<{
    [key: string]: any;
  }>(),

  response: json("response").$type<{
    submittedAt?: string;
    evidence?: any;
    [key: string]: any;
  }>(),

  // Provider data
  providerResponse: json("provider_response").$type<{
    [key: string]: any;
  }>(),

  // Resolution
  resolvedAt: timestamp("resolved_at"),
  resolution: varchar("resolution", { length: 50 }), // won, lost, accepted

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type PaymentRefund = typeof paymentRefunds.$inferSelect;
export type NewPaymentRefund = typeof paymentRefunds.$inferInsert;
export type PaymentWebhook = typeof paymentWebhooks.$inferSelect;
export type NewPaymentWebhook = typeof paymentWebhooks.$inferInsert;
export type PaymentDispute = typeof paymentDisputes.$inferSelect;
export type NewPaymentDispute = typeof paymentDisputes.$inferInsert;
