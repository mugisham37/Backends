/**
 * Analytics schema definition
 * Defines tables for tracking user behavior, business metrics, and system analytics
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
  index,
} from "drizzle-orm/pg-core";

// Event type enum for analytics tracking
export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "page_view",
  "user_action",
  "transaction",
  "product_view",
  "search",
  "cart_action",
  "checkout_step",
  "conversion",
  "error",
  "performance",
]);

// Analytics events table - tracks all user interactions and system events
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Event identification
    eventType: analyticsEventTypeEnum("event_type").notNull(),
    eventName: varchar("event_name", { length: 100 }).notNull(),
    eventCategory: varchar("event_category", { length: 50 }),

    // User and session tracking
    userId: uuid("user_id"), // References users.id (null for anonymous)
    sessionId: varchar("session_id", { length: 100 }),
    visitorId: varchar("visitor_id", { length: 100 }), // For anonymous tracking

    // Event data
    properties: json("properties").$type<Record<string, any>>(),
    value: decimal("value", { precision: 10, scale: 2 }), // Monetary value
    quantity: integer("quantity"), // Item quantity

    // Context information
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    referrer: text("referrer"),
    utm: json("utm").$type<{
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    }>(),

    // Geographic data
    country: varchar("country", { length: 2 }),
    region: varchar("region", { length: 100 }),
    city: varchar("city", { length: 100 }),

    // Technical context
    device: varchar("device", { length: 50 }),
    browser: varchar("browser", { length: 50 }),
    os: varchar("os", { length: 50 }),

    // Timestamps
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventTypeIdx: index("idx_analytics_events_type").on(table.eventType),
    userIdIdx: index("idx_analytics_events_user_id").on(table.userId),
    sessionIdIdx: index("idx_analytics_events_session_id").on(table.sessionId),
    timestampIdx: index("idx_analytics_events_timestamp").on(table.timestamp),
    eventNameIdx: index("idx_analytics_events_name").on(table.eventName),
  })
);

// Business metrics table - aggregated business KPIs
export const businessMetrics = pgTable(
  "business_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Metric identification
    metricName: varchar("metric_name", { length: 100 }).notNull(),
    metricType: varchar("metric_type", { length: 50 }).notNull(), // revenue, conversion, retention, etc.

    // Time period
    period: varchar("period", { length: 20 }).notNull(), // daily, weekly, monthly, yearly
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Metric values
    value: decimal("value", { precision: 15, scale: 2 }).notNull(),
    previousValue: decimal("previous_value", { precision: 15, scale: 2 }),
    percentageChange: decimal("percentage_change", { precision: 5, scale: 2 }),

    // Additional context
    currency: varchar("currency", { length: 3 }).default("USD"),
    segment: varchar("segment", { length: 100 }), // customer segment, product category, etc.
    metadata: json("metadata").$type<Record<string, any>>(),

    // Timestamps
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    metricNameIdx: index("idx_business_metrics_name").on(table.metricName),
    periodIdx: index("idx_business_metrics_period").on(
      table.period,
      table.periodStart
    ),
    segmentIdx: index("idx_business_metrics_segment").on(table.segment),
  })
);

// User behavior analytics - tracks user journey and behavior patterns
export const userBehaviorAnalytics = pgTable(
  "user_behavior_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // User identification
    userId: uuid("user_id"), // References users.id
    sessionId: varchar("session_id", { length: 100 }).notNull(),

    // Session data
    sessionStart: timestamp("session_start").notNull(),
    sessionEnd: timestamp("session_end"),
    sessionDuration: integer("session_duration"), // in seconds

    // Behavior metrics
    pageViews: integer("page_views").default(0),
    bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }),
    conversionEvents: integer("conversion_events").default(0),

    // Engagement metrics
    clickCount: integer("click_count").default(0),
    scrollDepth: decimal("scroll_depth", { precision: 5, scale: 2 }), // percentage
    timeOnSite: integer("time_on_site"), // in seconds

    // Journey data
    entryPage: text("entry_page"),
    exitPage: text("exit_page"),
    pageSequence: json("page_sequence").$type<string[]>(),

    // Device and context
    device: varchar("device", { length: 50 }),
    browser: varchar("browser", { length: 50 }),
    userAgent: text("user_agent"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_user_behavior_user_id").on(table.userId),
    sessionIdIdx: index("idx_user_behavior_session_id").on(table.sessionId),
    sessionStartIdx: index("idx_user_behavior_session_start").on(
      table.sessionStart
    ),
  })
);

// Product analytics - tracks product performance and user interactions
export const productAnalytics = pgTable(
  "product_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Product identification
    productId: uuid("product_id").notNull(), // References products.id
    vendorId: uuid("vendor_id"), // References vendors.id

    // Time period
    date: timestamp("date").notNull(),
    period: varchar("period", { length: 20 }).notNull(), // daily, weekly, monthly

    // View metrics
    views: integer("views").default(0),
    uniqueViews: integer("unique_views").default(0),
    impressions: integer("impressions").default(0),

    // Engagement metrics
    addToCart: integer("add_to_cart").default(0),
    addToWishlist: integer("add_to_wishlist").default(0),
    shares: integer("shares").default(0),
    reviews: integer("reviews").default(0),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),

    // Conversion metrics
    purchases: integer("purchases").default(0),
    revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0.00"),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }),

    // Performance metrics
    bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }),
    averageTimeSpent: integer("average_time_spent"), // in seconds

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("idx_product_analytics_product_id").on(table.productId),
    vendorIdIdx: index("idx_product_analytics_vendor_id").on(table.vendorId),
    dateIdx: index("idx_product_analytics_date").on(table.date),
    periodIdx: index("idx_product_analytics_period").on(table.period),
  })
);

// Export types
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type BusinessMetric = typeof businessMetrics.$inferSelect;
export type NewBusinessMetric = typeof businessMetrics.$inferInsert;

export type UserBehaviorAnalytics = typeof userBehaviorAnalytics.$inferSelect;
export type NewUserBehaviorAnalytics =
  typeof userBehaviorAnalytics.$inferInsert;

export type ProductAnalytics = typeof productAnalytics.$inferSelect;
export type NewProductAnalytics = typeof productAnalytics.$inferInsert;
