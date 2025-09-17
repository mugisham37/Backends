/**
 * Webhook schema definition
 * Defines tables for webhook endpoints, delivery attempts, and event subscriptions
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  json,
  index,
} from "drizzle-orm/pg-core";

// Webhook status enum
export const webhookStatusEnum = pgEnum("webhook_status", [
  "active",
  "inactive",
  "failed",
  "suspended",
]);

// Webhook event type enum
export const webhookEventTypeEnum = pgEnum("webhook_event_type", [
  "order.created",
  "order.updated",
  "order.cancelled",
  "order.fulfilled",
  "payment.succeeded",
  "payment.failed",
  "product.created",
  "product.updated",
  "product.deleted",
  "user.created",
  "user.updated",
  "vendor.approved",
  "vendor.rejected",
  "notification.sent",
  "system.error",
]);

// HTTP method enum
export const httpMethodEnum = pgEnum("http_method", [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

// Delivery status enum
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "success",
  "failed",
  "retrying",
  "timeout",
  "invalid_response",
]);

// Webhook endpoints table - stores webhook endpoint configurations
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Endpoint identification
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    url: text("url").notNull(),

    // Configuration
    httpMethod: httpMethodEnum("http_method").default("POST").notNull(),
    secret: varchar("secret", { length: 255 }), // For signature verification
    contentType: varchar("content_type", { length: 50 }).default(
      "application/json"
    ),

    // Status and settings
    status: webhookStatusEnum("status").default("active").notNull(),
    isActive: boolean("is_active").default(true),
    maxRetries: integer("max_retries").default(3),
    timeoutSeconds: integer("timeout_seconds").default(30),

    // Event filtering
    eventTypes: json("event_types").$type<string[]>().notNull(), // Array of subscribed event types
    filters: json("filters").$type<Record<string, any>>(), // Additional filtering criteria

    // Headers and authentication
    headers: json("headers").$type<Record<string, string>>(), // Custom headers to send
    authType: varchar("auth_type", { length: 20 }), // bearer, basic, api_key, etc.
    authCredentials: json("auth_credentials").$type<Record<string, string>>(), // Encrypted auth data

    // Owner information
    userId: uuid("user_id"), // References users.id (webhook owner)
    vendorId: uuid("vendor_id"), // References vendors.id (if vendor-specific)

    // Statistics
    totalDeliveries: integer("total_deliveries").default(0),
    successfulDeliveries: integer("successful_deliveries").default(0),
    failedDeliveries: integer("failed_deliveries").default(0),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("idx_webhook_endpoints_status").on(table.status),
    userIdIdx: index("idx_webhook_endpoints_user_id").on(table.userId),
    vendorIdIdx: index("idx_webhook_endpoints_vendor_id").on(table.vendorId),
    // eventTypesIdx: removed because JSON columns cannot be indexed with btree
  })
);

// Webhook events table - stores events to be delivered to webhooks
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Event identification
    eventType: webhookEventTypeEnum("event_type").notNull(),
    eventId: varchar("event_id", { length: 100 }).notNull(), // Unique event identifier

    // Event data
    payload: json("payload").$type<Record<string, any>>().notNull(),
    metadata: json("metadata").$type<Record<string, any>>(),

    // Source information
    sourceId: varchar("source_id", { length: 100 }), // ID of the entity that triggered the event
    sourceType: varchar("source_type", { length: 50 }), // Type of source (order, product, etc.)

    // User/vendor context
    userId: uuid("user_id"), // References users.id
    vendorId: uuid("vendor_id"), // References vendors.id

    // Processing status
    isProcessed: boolean("is_processed").default(false),
    processedAt: timestamp("processed_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventTypeIdx: index("idx_webhook_events_event_type").on(table.eventType),
    eventIdIdx: index("idx_webhook_events_event_id").on(table.eventId),
    isProcessedIdx: index("idx_webhook_events_is_processed").on(
      table.isProcessed
    ),
    sourceIdIdx: index("idx_webhook_events_source_id").on(table.sourceId),
    createdAtIdx: index("idx_webhook_events_created_at").on(table.createdAt),
  })
);

// Webhook deliveries table - tracks delivery attempts to webhook endpoints
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    webhookEndpointId: uuid("webhook_endpoint_id").notNull(), // References webhook_endpoints.id
    webhookEventId: uuid("webhook_event_id").notNull(), // References webhook_events.id

    // Delivery details
    attemptNumber: integer("attempt_number").default(1).notNull(),
    deliveryStatus: deliveryStatusEnum("delivery_status")
      .default("pending")
      .notNull(),

    // Request details
    requestUrl: text("request_url").notNull(),
    requestMethod: varchar("request_method", { length: 10 }).notNull(),
    requestHeaders: json("request_headers").$type<Record<string, string>>(),
    requestBody: text("request_body"),

    // Response details
    responseStatus: integer("response_status"),
    responseHeaders: json("response_headers").$type<Record<string, string>>(),
    responseBody: text("response_body"),
    responseTime: integer("response_time"), // in milliseconds

    // Error information
    errorMessage: text("error_message"),
    errorCode: varchar("error_code", { length: 50 }),

    // Timing
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
    nextRetryAt: timestamp("next_retry_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    webhookEndpointIdIdx: index("idx_webhook_deliveries_endpoint_id").on(
      table.webhookEndpointId
    ),
    webhookEventIdIdx: index("idx_webhook_deliveries_event_id").on(
      table.webhookEventId
    ),
    deliveryStatusIdx: index("idx_webhook_deliveries_status").on(
      table.deliveryStatus
    ),
    scheduledAtIdx: index("idx_webhook_deliveries_scheduled_at").on(
      table.scheduledAt
    ),
    nextRetryAtIdx: index("idx_webhook_deliveries_next_retry_at").on(
      table.nextRetryAt
    ),
  })
);

// Webhook subscriptions table - many-to-many relationship between endpoints and event types
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    webhookEndpointId: uuid("webhook_endpoint_id").notNull(), // References webhook_endpoints.id
    eventType: webhookEventTypeEnum("event_type").notNull(),

    // Subscription settings
    isActive: boolean("is_active").default(true),
    filters: json("filters").$type<Record<string, any>>(), // Event-specific filters

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    webhookEndpointIdIdx: index("idx_webhook_subscriptions_endpoint_id").on(
      table.webhookEndpointId
    ),
    eventTypeIdx: index("idx_webhook_subscriptions_event_type").on(
      table.eventType
    ),
    isActiveIdx: index("idx_webhook_subscriptions_is_active").on(
      table.isActive
    ),
  })
);

// Webhook logs table - detailed logging for debugging and monitoring
export const webhookLogs = pgTable(
  "webhook_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    webhookEndpointId: uuid("webhook_endpoint_id"), // References webhook_endpoints.id
    webhookDeliveryId: uuid("webhook_delivery_id"), // References webhook_deliveries.id

    // Log details
    logLevel: varchar("log_level", { length: 10 }).notNull(), // info, warn, error, debug
    message: text("message").notNull(),
    context: json("context").$type<Record<string, any>>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    webhookEndpointIdIdx: index("idx_webhook_logs_endpoint_id").on(
      table.webhookEndpointId
    ),
    webhookDeliveryIdIdx: index("idx_webhook_logs_delivery_id").on(
      table.webhookDeliveryId
    ),
    logLevelIdx: index("idx_webhook_logs_log_level").on(table.logLevel),
    createdAtIdx: index("idx_webhook_logs_created_at").on(table.createdAt),
  })
);

// Export types
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
