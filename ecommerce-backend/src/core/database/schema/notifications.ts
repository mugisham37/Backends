/**
 * Notification schema definition
 * Defines the notifications table structure for real-time notification system
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  boolean,
  json,
  index,
} from "drizzle-orm/pg-core";

// Notification type enum
export const notificationTypeEnum = pgEnum("notification_type", [
  "order_created",
  "order_updated",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "payment_received",
  "payment_failed",
  "product_approved",
  "product_rejected",
  "vendor_approved",
  "vendor_rejected",
  "payout_processed",
  "review_received",
  "system_alert",
  "security_alert",
  "welcome",
  "password_reset",
  "email_verification",
  "custom",
]);

// Notification priority enum
export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

// Notification channel enum
export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
  "push",
  "webhook",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // References users.id

    // Notification content
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    priority: notificationPriorityEnum("priority").default("normal").notNull(),

    // Channels and delivery
    channels: json("channels").$type<string[]>().default(["in_app"]).notNull(),
    deliveredChannels: json("delivered_channels").$type<string[]>().default([]),

    // Status tracking
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),

    // Metadata and context
    metadata: json("metadata").$type<{
      entityType?: string; // e.g., "order", "product", "vendor"
      entityId?: string;
      actionUrl?: string;
      imageUrl?: string;
      expiresAt?: string;
      [key: string]: any;
    }>(),

    // Grouping and categorization
    category: varchar("category", { length: 100 }),
    tags: json("tags").$type<string[]>().default([]),

    // Timestamps
    scheduledFor: timestamp("scheduled_for"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    typeIdx: index("notifications_type_idx").on(table.type),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    scheduledForIdx: index("notifications_scheduled_for_idx").on(
      table.scheduledFor
    ),
    categoryIdx: index("notifications_category_idx").on(table.category),
  })
);

// Notification preferences table
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().unique(), // References users.id

    // Channel preferences
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    smsEnabled: boolean("sms_enabled").default(false).notNull(),
    pushEnabled: boolean("push_enabled").default(true).notNull(),
    inAppEnabled: boolean("in_app_enabled").default(true).notNull(),

    // Type-specific preferences
    preferences: json("preferences")
      .$type<{
        [key in (typeof notificationTypeEnum.enumValues)[number]]?: {
          enabled: boolean;
          channels: string[];
          frequency?: "immediate" | "daily" | "weekly" | "never";
        };
      }>()
      .default({}),

    // Quiet hours
    quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
    quietHoursStart: varchar("quiet_hours_start", { length: 5 }), // HH:MM format
    quietHoursEnd: varchar("quiet_hours_end", { length: 5 }), // HH:MM format
    quietHoursTimezone: varchar("quiet_hours_timezone", { length: 50 }).default(
      "UTC"
    ),

    // Digest preferences
    dailyDigestEnabled: boolean("daily_digest_enabled").default(false),
    weeklyDigestEnabled: boolean("weekly_digest_enabled").default(false),
    digestTime: varchar("digest_time", { length: 5 }).default("09:00"), // HH:MM format

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("notification_preferences_user_id_idx").on(table.userId),
  })
);

// Notification templates table for customizable notifications
export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Template identification
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    language: varchar("language", { length: 5 }).default("en").notNull(),

    // Template content
    subject: varchar("subject", { length: 255 }),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),

    // Template metadata
    variables: json("variables").$type<string[]>().default([]),
    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    typeChannelIdx: index("notification_templates_type_channel_idx").on(
      table.type,
      table.channel
    ),
    languageIdx: index("notification_templates_language_idx").on(
      table.language
    ),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences =
  typeof notificationPreferences.$inferInsert;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;

// Type helpers
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type NotificationPriority =
  (typeof notificationPriorityEnum.enumValues)[number];
export type NotificationChannel =
  (typeof notificationChannelEnum.enumValues)[number];
