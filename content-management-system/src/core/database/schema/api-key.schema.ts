import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant.schema";

/**
 * API Key scopes enum
 */
export const apiKeyScopeEnum = pgEnum("api_key_scope", [
  "read",
  "write",
  "admin",
  "content:read",
  "content:write",
  "content:delete",
  "media:read",
  "media:write",
  "media:delete",
  "users:read",
  "users:write",
  "users:delete",
  "analytics:read",
  "webhooks:read",
  "webhooks:write",
]);

/**
 * API keys table for authentication
 */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  tenantId: uuid("tenant_id").references(() => tenants.id, {
    onDelete: "cascade",
  }),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").notNull().default(0),
  rateLimit: integer("rate_limit").default(1000), // requests per hour
  allowedIps: jsonb("allowed_ips").$type<string[]>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").notNull(),
});

/**
 * Type definitions
 */
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

/**
 * API Key scopes enum for TypeScript
 */
export enum ApiKeyScope {
  READ = "read",
  WRITE = "write",
  ADMIN = "admin",
  CONTENT_READ = "content:read",
  CONTENT_WRITE = "content:write",
  CONTENT_DELETE = "content:delete",
  MEDIA_READ = "media:read",
  MEDIA_WRITE = "media:write",
  MEDIA_DELETE = "media:delete",
  USERS_READ = "users:read",
  USERS_WRITE = "users:write",
  USERS_DELETE = "users:delete",
  ANALYTICS_READ = "analytics:read",
  WEBHOOKS_READ = "webhooks:read",
  WEBHOOKS_WRITE = "webhooks:write",
}

/**
 * API Key with relations
 */
export interface ApiKeyWithRelations extends ApiKey {
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}
