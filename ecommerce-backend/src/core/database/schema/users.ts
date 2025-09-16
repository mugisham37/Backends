/**
 * User schema definition
 * Defines the users table structure with proper relationships and constraints
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";

// User role enum
export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "vendor",
  "admin",
  "moderator",
]);

// User status enum
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
  "pending",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: userRoleEnum("role").default("customer").notNull(),
  status: userStatusEnum("status").default("active").notNull(),

  // Profile information
  phoneNumber: varchar("phone_number", { length: 20 }),
  dateOfBirth: timestamp("date_of_birth"),
  bio: text("bio"),
  avatar: varchar("avatar", { length: 500 }),

  // Preferences
  language: varchar("language", { length: 5 }).default("en"),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),

  // Authentication
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token", { length: 255 }),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),

  // Timestamps
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
