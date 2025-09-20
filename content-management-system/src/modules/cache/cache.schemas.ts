import { z } from "zod";
import {
  paginatedResponseSchema,
  paginationQuerySchema,
  successResponseSchema,
  uuidSchema,
} from "../../shared/validators/common.schemas";

/**
 * Zod validation schemas for cache management endpoints
 */

// Cache configuration schema
export const cacheConfigSchema = z.object({
  host: z.string().min(1, "Redis host is required"),
  port: z.number().int().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).max(15).default(0),
  keyPrefix: z.string().default("cms:"),
  defaultTtl: z.number().int().min(1).default(3600), // 1 hour
  maxRetries: z.number().int().min(0).max(10).default(3),
});

// Cache options schema
export const cacheOptionsSchema = z.object({
  ttl: z.number().int().min(1).optional(),
  tags: z.array(z.string()).optional(),
  namespace: z.string().optional(),
});

// Cache entry schema
export const cacheEntrySchema = z.object({
  key: z.string().min(1, "Cache key is required"),
  value: z.any(),
  ttl: z.number().int().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  tags: z.array(z.string()),
});

// Cache operation schemas
export const setCacheSchema = z.object({
  key: z
    .string()
    .min(1, "Cache key is required")
    .max(250, "Cache key must be less than 250 characters"),
  value: z.any(),
  ttl: z
    .number()
    .int()
    .min(1)
    .max(86400 * 30)
    .optional(), // Max 30 days
  tags: z.array(z.string()).optional(),
  namespace: z.string().optional(),
});

export const getCacheSchema = z.object({
  key: z
    .string()
    .min(1, "Cache key is required")
    .max(250, "Cache key must be less than 250 characters"),
  namespace: z.string().optional(),
});

export const deleteCacheSchema = z.object({
  key: z
    .string()
    .min(1, "Cache key is required")
    .max(250, "Cache key must be less than 250 characters"),
  namespace: z.string().optional(),
});

export const invalidateByTagSchema = z.object({
  tags: z.array(z.string()).min(1, "At least one tag is required"),
  namespace: z.string().optional(),
});

export const bulkDeleteCacheSchema = z.object({
  keys: z.array(z.string()).min(1, "At least one key is required"),
  namespace: z.string().optional(),
});

export const flushCacheSchema = z.object({
  namespace: z.string().optional(),
  pattern: z.string().optional(),
});

// Session schemas
export const sessionDataSchema = z.object({
  userId: uuidSchema,
  tenantId: uuidSchema.optional(),
  role: z.string(),
  permissions: z.array(z.string()),
  lastActivity: z.string().datetime(),
});

export const sessionOptionsSchema = z.object({
  ttl: z.number().int().min(1).optional(),
  sliding: z.boolean().default(true),
  secure: z.boolean().default(true),
});

export const createSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  data: sessionDataSchema,
  options: sessionOptionsSchema.optional(),
});

export const updateSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  data: sessionDataSchema.partial(),
  extendTtl: z.boolean().default(true),
});

export const getSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

// Cache query schema
export const cacheQuerySchema = paginationQuerySchema.extend({
  namespace: z.string().optional(),
  pattern: z.string().optional(),
  tag: z.string().optional(),
  sortBy: z
    .enum(["key", "createdAt", "expiresAt", "size"])
    .default("createdAt"),
});

// Response schemas
export const cacheStatsSchema = z.object({
  hits: z.number(),
  misses: z.number(),
  hitRate: z.number(),
  totalKeys: z.number(),
  memoryUsage: z.number(),
  evictedKeys: z.number(),
  expiredKeys: z.number(),
  connectionStatus: z.enum(["connected", "disconnected", "connecting"]),
});

export const cacheHealthSchema = z.object({
  status: z.enum(["healthy", "unhealthy", "degraded"]),
  uptime: z.number(),
  memoryUsage: z.object({
    used: z.number(),
    peak: z.number(),
    limit: z.number(),
  }),
  connections: z.object({
    active: z.number(),
    total: z.number(),
  }),
  latency: z.object({
    avg: z.number(),
    p95: z.number(),
    p99: z.number(),
  }),
});

export const cacheKeysResponseSchema = z.object({
  keys: z.array(z.string()),
  count: z.number(),
  namespace: z.string().optional(),
});

export const cacheOperationResultSchema = z.object({
  success: z.boolean(),
  key: z.string().optional(),
  message: z.string().optional(),
});

export const bulkCacheOperationResultSchema = z.object({
  totalOperations: z.number(),
  successfulOperations: z.number(),
  failedOperations: z.number(),
  results: z.array(cacheOperationResultSchema),
});

// Cache event schema
export const cacheEventSchema = z.enum([
  "set",
  "get",
  "delete",
  "expire",
  "flush",
]);

export const cacheActivitySchema = z.object({
  event: cacheEventSchema,
  key: z.string(),
  namespace: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

// Response schemas
export const cacheEntryResponseSchema = successResponseSchema(cacheEntrySchema);
export const cacheStatsResponseSchema = successResponseSchema(cacheStatsSchema);
export const cacheHealthResponseSchema =
  successResponseSchema(cacheHealthSchema);
export const cacheKeysResponseSchemaSuccess = successResponseSchema(
  cacheKeysResponseSchema
);
export const cacheOperationResponseSchema = successResponseSchema(
  cacheOperationResultSchema
);
export const bulkCacheOperationResponseSchema = successResponseSchema(
  bulkCacheOperationResultSchema
);
export const sessionDataResponseSchema =
  successResponseSchema(sessionDataSchema);
export const cacheConfigResponseSchema =
  successResponseSchema(cacheConfigSchema);
export const cacheActivityListResponseSchema =
  paginatedResponseSchema(cacheActivitySchema);

// Endpoint schemas
export const setCacheEndpoint = {
  body: setCacheSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const getCacheEndpoint = {
  body: z.void(),
  query: getCacheSchema,
  params: z.void(),
  headers: z.void(),
};

export const deleteCacheEndpoint = {
  body: z.void(),
  query: deleteCacheSchema,
  params: z.void(),
  headers: z.void(),
};

export const invalidateByTagEndpoint = {
  body: invalidateByTagSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const bulkDeleteCacheEndpoint = {
  body: bulkDeleteCacheSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const flushCacheEndpoint = {
  body: flushCacheSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const getCacheKeysEndpoint = {
  body: z.void(),
  query: cacheQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const getCacheStatsEndpoint = {
  body: z.void(),
  query: z.object({
    detailed: z.coerce.boolean().default(false),
  }),
  params: z.void(),
  headers: z.void(),
};

export const getCacheHealthEndpoint = {
  body: z.void(),
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const createSessionEndpoint = {
  body: createSessionSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateSessionEndpoint = {
  body: updateSessionSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const getSessionEndpoint = {
  body: z.void(),
  query: getSessionSchema,
  params: z.void(),
  headers: z.void(),
};

export const updateCacheConfigEndpoint = {
  body: cacheConfigSchema.partial(),
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

// Type exports
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
export type CacheOptions = z.infer<typeof cacheOptionsSchema>;
export type CacheEntry = z.infer<typeof cacheEntrySchema>;
export type SetCacheRequest = z.infer<typeof setCacheSchema>;
export type GetCacheRequest = z.infer<typeof getCacheSchema>;
export type DeleteCacheRequest = z.infer<typeof deleteCacheSchema>;
export type InvalidateByTagRequest = z.infer<typeof invalidateByTagSchema>;
export type BulkDeleteCacheRequest = z.infer<typeof bulkDeleteCacheSchema>;
export type FlushCacheRequest = z.infer<typeof flushCacheSchema>;
export type SessionData = z.infer<typeof sessionDataSchema>;
export type SessionOptions = z.infer<typeof sessionOptionsSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionSchema>;
export type UpdateSessionRequest = z.infer<typeof updateSessionSchema>;
export type GetSessionRequest = z.infer<typeof getSessionSchema>;
export type CacheQueryParams = z.infer<typeof cacheQuerySchema>;
export type CacheStats = z.infer<typeof cacheStatsSchema>;
export type CacheHealth = z.infer<typeof cacheHealthSchema>;
export type CacheKeysResponse = z.infer<typeof cacheKeysResponseSchema>;
export type CacheOperationResult = z.infer<typeof cacheOperationResultSchema>;
export type BulkCacheOperationResult = z.infer<
  typeof bulkCacheOperationResultSchema
>;
export type CacheEvent = z.infer<typeof cacheEventSchema>;
export type CacheActivity = z.infer<typeof cacheActivitySchema>;
export type CacheEntryResponse = z.infer<typeof cacheEntryResponseSchema>;
export type CacheStatsResponse = z.infer<typeof cacheStatsResponseSchema>;
export type CacheHealthResponse = z.infer<typeof cacheHealthResponseSchema>;
export type CacheOperationResponse = z.infer<
  typeof cacheOperationResponseSchema
>;
export type BulkCacheOperationResponse = z.infer<
  typeof bulkCacheOperationResponseSchema
>;
export type SessionDataResponse = z.infer<typeof sessionDataResponseSchema>;
export type CacheConfigResponse = z.infer<typeof cacheConfigResponseSchema>;
