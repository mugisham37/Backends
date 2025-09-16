/**
 * Notification Database Schema
 * Defines tables for notifications, preferences, and templates
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// Enums
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

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
  "push",
  "webhook",
]);

// Notifications table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  priority: notificationPriorityEnum("priority").notNull().default("normal"),
  channels: jsonb("channels").$type<string[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<{
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    imageUrl?: string;
    expiresAt?: string;
    [key: string]: any;
  }>(),
  category: varchar("category", { length: 100 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  deliveredChannels: jsonb("delivered_channels").$type<string[]>().default([]),
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notification preferences table
export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  preferences: jsonb("preferences")
    .$type<
      Record<
        string,
        {
          enabled: boolean;
          channels: string[];
          frequency?: "immediate" | "daily" | "weekly" | "never";
        }
      >
    >()
    .notNull()
    .default({}),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }), // HH:MM format
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }), // HH:MM format
  quietHoursTimezone: varchar("quiet_hours_timezone", { length: 50 }).default(
    "UTC"
  ),
  dailyDigestEnabled: boolean("daily_digest_enabled").notNull().default(false),
  weeklyDigestEnabled: boolean("weekly_digest_enabled")
    .notNull()
    .default(false),
  digestTime: varchar("digest_time", { length: 5 }).default("09:00"), // HH:MM format
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notification templates table
export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  language: varchar("language", { length: 5 }).notNull().default("en"),
  subject: varchar("subject", { length: 255 }),
  template: text("template").notNull(),
  variables: jsonb("variables").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Type exports
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type NotificationPriority =
  (typeof notificationPriorityEnum.enumValues)[number];
export type NotificationChannel =
  (typeof notificationChannelEnum.enumValues)[number];

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences =
  typeof notificationPreferences.$inferInsert;

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;

// Zod schemas for validation
export const insertNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(notificationTypeEnum.enumValues),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  priority: z.enum(notificationPriorityEnum.enumValues).default("normal"),
  channels: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  scheduledFor: z.date().optional(),
});

export const selectNotificationSchema = insertNotificationSchema.extend({
  id: z.string().uuid(),
  isRead: z.boolean(),
  readAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  deliveredChannels: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertNotificationPreferencesSchema = z.object({
  userId: z.string().uuid(),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(true),
  inAppEnabled: z.boolean().default(true),
  preferences: z
    .record(
      z.object({
        enabled: z.boolean(),
        channels: z.array(z.string()),
        frequency: z.enum(["immediate", "daily", "weekly", "never"]).optional(),
      })
    )
    .default({}),
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  quietHoursTimezone: z.string().default("UTC"),
  dailyDigestEnabled: z.boolean().default(false),
  weeklyDigestEnabled: z.boolean().default(false),
  digestTime: z.string().default("09:00"),
});

export const selectNotificationPreferencesSchema =
  insertNotificationPreferencesSchema.extend({
    id: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });
