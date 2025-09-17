// Legacy API Key model for backward compatibility
// This is a compatibility layer that maps to the new Drizzle schema

// Re-export from the core schema
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
 * @deprecated Use the actual API key schema from core/database/schema instead
 * This type is kept for backward compatibility only
 */
export type ApiKeyModel = {
  _id: string;
  name: string;
  scopes: string[];
  tenantId?: string;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

// Export actual schema types for new code
export type { ApiKey } from "../../../core/database/schema/api-key.schema";
