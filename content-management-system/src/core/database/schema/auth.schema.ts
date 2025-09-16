import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { contents } from "./content.schema";
import { media } from "./media.schema";
import { tenants } from "./tenant.schema";

/**
 * User roles enum
 */
export const userRoles = [
  "super_admin",
  "admin",
  "editor",
  "author",
  "viewer",
] as const;
export type UserRole = (typeof userRoles)[number];

/**
 * Users table - Authentication and user management
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    displayName: varchar("display_name", { length: 200 }),
    avatar: text("avatar"), // URL to avatar image
    role: varchar("role", { length: 20 }).notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    emailVerificationToken: varchar("email_verification_token", {
      length: 255,
    }),
    passwordResetToken: varchar("password_reset_token", { length: 255 }),
    passwordResetExpiresAt: timestamp("password_reset_expires_at"),
    lastLoginAt: timestamp("last_login_at"),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    preferences: jsonb("preferences").$type<{
      language?: string;
      timezone?: string;
      theme?: "light" | "dark" | "auto";
      notifications?: {
        email?: boolean;
        push?: boolean;
        inApp?: boolean;
      };
    }>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("user_email_idx").on(table.email),
    tenantIdx: index("user_tenant_idx").on(table.tenantId),
    roleIdx: index("user_role_idx").on(table.role),
    activeIdx: index("user_active_idx").on(table.isActive),
    lastLoginIdx: index("user_last_login_idx").on(table.lastLoginAt),
  })
);

/**
 * User sessions table - JWT token management
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 255 }),
    deviceInfo: jsonb("device_info").$type<{
      userAgent?: string;
      ip?: string;
      platform?: string;
      browser?: string;
    }>(),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("session_user_idx").on(table.userId),
    tokenIdx: index("session_token_idx").on(table.tokenHash),
    refreshTokenIdx: index("session_refresh_token_idx").on(
      table.refreshTokenHash
    ),
    activeIdx: index("session_active_idx").on(table.isActive),
    expiresIdx: index("session_expires_idx").on(table.expiresAt),
  })
);

/**
 * User permissions table - Fine-grained permissions
 */
export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    resource: varchar("resource", { length: 100 }).notNull(), // e.g., "content", "media", "users"
    action: varchar("action", { length: 50 }).notNull(), // e.g., "create", "read", "update", "delete"
    conditions: jsonb("conditions").$type<Record<string, unknown>>(), // Additional conditions
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userResourceIdx: index("permission_user_resource_idx").on(
      table.userId,
      table.resource
    ),
    resourceActionIdx: index("permission_resource_action_idx").on(
      table.resource,
      table.action
    ),
  })
);

/**
 * User relations
 */
export const userRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  sessions: many(userSessions),
  permissions: many(userPermissions),
  contents: many(contents),
  media: many(media),
}));

export const userSessionRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userPermissionRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
    }),
  })
);

/**
 * TypeScript types for auth schemas
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPreferences = NonNullable<User["preferences"]>;
export type UserMetadata = NonNullable<User["metadata"]>;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type SessionDeviceInfo = NonNullable<UserSession["deviceInfo"]>;

export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;
