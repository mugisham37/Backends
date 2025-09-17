import type { FastifyRequest, FastifyReply } from "fastify";
import { inject, injectable } from "tsyringe";
import { CacheService } from "./cache.service";
import type {
  SetCacheRequest,
  GetCacheRequest,
  DeleteCacheRequest,
  BulkDeleteCacheRequest,
  FlushCacheRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
} from "./cache.schemas";
import type { SessionData } from "./cache.types";
import { RequireAdmin } from "../../core/decorators/auth.decorator";

// Type definitions for Fastify requests
interface SessionParams {
  sessionId?: string;
}

interface CacheStatsQuery {
  detailed?: string;
}

/**
 * Cache controller for Fastify
 * Handles Redis cache operations, session management, and cache administration
 */
@injectable()
@RequireAdmin()
export class CacheController {
  constructor(@inject("CacheService") private cacheService: CacheService) {}

  /**
   * Get value from cache
   */
  public getCache = async (
    request: FastifyRequest<{
      Querystring: GetCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, namespace } = request.query;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const value = await this.cacheService.get(fullKey);

      if (value === null) {
        return reply.status(404).send({
          status: "error",
          message: "Cache key not found",
          code: "CACHE_KEY_NOT_FOUND",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          key: fullKey,
          value,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Set value in cache
   */
  public setCache = async (
    request: FastifyRequest<{
      Body: SetCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, value, ttl, namespace } = request.body;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const result = await this.cacheService.set(fullKey, value, ttl);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to set cache value",
          code: "CACHE_SET_FAILED",
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          key: fullKey,
          message: "Cache value set successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Delete value from cache
   */
  public deleteCache = async (
    request: FastifyRequest<{
      Querystring: DeleteCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, namespace } = request.query;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const result = await this.cacheService.delete(fullKey);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to delete cache value",
          code: "CACHE_DELETE_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          key: fullKey,
          message: "Cache value deleted successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Check if key exists in cache
   */
  public existsCache = async (
    request: FastifyRequest<{
      Querystring: GetCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, namespace } = request.query;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const exists = await this.cacheService.exists(fullKey);

      return reply.status(200).send({
        status: "success",
        data: {
          key: fullKey,
          exists,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get TTL for a cache key
   */
  public getCacheTTL = async (
    request: FastifyRequest<{
      Querystring: GetCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, namespace } = request.query;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const ttl = await this.cacheService.getTTL(fullKey);

      return reply.status(200).send({
        status: "success",
        data: {
          key: fullKey,
          ttl,
          message:
            ttl === -1
              ? "Key does not exist"
              : ttl === -2
              ? "Key exists but has no expiration"
              : `Key expires in ${ttl} seconds`,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get multiple values from cache
   */
  public getMultipleCache = async (
    request: FastifyRequest<{
      Body: { keys: string[]; namespace?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { keys, namespace } = request.body;
      const fullKeys = namespace
        ? keys.map((key) => `${namespace}:${key}`)
        : keys;

      const values = await this.cacheService.mget(fullKeys);

      const results = fullKeys.map((key, index) => ({
        key,
        value: values[index],
        found: values[index] !== null,
      }));

      return reply.status(200).send({
        status: "success",
        data: {
          results,
          totalKeys: keys.length,
          foundKeys: results.filter((r) => r.found).length,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Set multiple values in cache
   */
  public setMultipleCache = async (
    request: FastifyRequest<{
      Body: {
        entries: Array<{ key: string; value: any; ttl?: number }>;
        namespace?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { entries, namespace } = request.body;
      const processedEntries = entries.map((entry) => ({
        ...entry,
        key: namespace ? `${namespace}:${entry.key}` : entry.key,
      }));

      const result = await this.cacheService.mset(processedEntries);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message:
            result.error?.message || "Failed to set multiple cache values",
          code: "CACHE_MSET_FAILED",
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          totalEntries: entries.length,
          message: "Multiple cache values set successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Delete multiple cache keys
   */
  public deleteMultipleCache = async (
    request: FastifyRequest<{
      Body: BulkDeleteCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { keys, namespace } = request.body;
      const fullKeys = namespace
        ? keys.map((key) => `${namespace}:${key}`)
        : keys;

      let successCount = 0;
      let failedCount = 0;
      const results = [];

      for (const key of fullKeys) {
        const result = await this.cacheService.delete(key);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }
        results.push({
          key,
          success: result.success,
          error: result.success ? undefined : result.error?.message,
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          totalOperations: keys.length,
          successfulOperations: successCount,
          failedOperations: failedCount,
          results,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Invalidate cache by pattern
   */
  public invalidatePattern = async (
    request: FastifyRequest<{
      Body: { pattern: string; namespace?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { pattern, namespace } = request.body;
      const fullPattern = namespace ? `${namespace}:${pattern}` : pattern;

      const result = await this.cacheService.invalidatePattern(fullPattern);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message:
            result.error?.message || "Failed to invalidate cache pattern",
          code: "CACHE_INVALIDATE_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          pattern: fullPattern,
          deletedKeys: result.data,
          message: `Invalidated ${result.data} cache entries`,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Clear all cache
   */
  public clearCache = async (
    request: FastifyRequest<{
      Body: FlushCacheRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // Check if user has admin privileges (this should be handled by middleware)
      const userId = (request as any).user?._id;
      const userRole = (request as any).user?.role;

      if (!userId || userRole !== "admin") {
        return reply.status(403).send({
          status: "error",
          message: "Insufficient permissions to clear cache",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      const { pattern, namespace } = request.body;

      if (pattern || namespace) {
        // Pattern-based clearing
        const fullPattern = namespace
          ? `${namespace}:${pattern || "*"}`
          : pattern || "*";
        const result = await this.cacheService.invalidatePattern(fullPattern);

        if (!result.success) {
          return reply.status(400).send({
            status: "error",
            message:
              result.error?.message || "Failed to clear cache by pattern",
            code: "CACHE_CLEAR_FAILED",
          });
        }

        return reply.status(200).send({
          status: "success",
          data: {
            pattern: fullPattern,
            deletedKeys: result.data,
            message: `Cleared ${result.data} cache entries`,
          },
        });
      } else {
        // Clear all cache
        const result = await this.cacheService.clear();

        if (!result.success) {
          return reply.status(400).send({
            status: "error",
            message: result.error?.message || "Failed to clear cache",
            code: "CACHE_CLEAR_FAILED",
          });
        }

        return reply.status(200).send({
          status: "success",
          data: {
            message: "All cache cleared successfully",
          },
        });
      }
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Increment numeric value in cache
   */
  public incrementCache = async (
    request: FastifyRequest<{
      Body: { key: string; amount?: number; namespace?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, amount = 1, namespace } = request.body;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const result = await this.cacheService.increment(fullKey, amount);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to increment cache value",
          code: "CACHE_INCREMENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          key: fullKey,
          newValue: result.data,
          increment: amount,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Set expiration for cache key
   */
  public expireCache = async (
    request: FastifyRequest<{
      Body: { key: string; ttl: number; namespace?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { key, ttl, namespace } = request.body;
      const fullKey = namespace ? `${namespace}:${key}` : key;

      const result = await this.cacheService.expire(fullKey, ttl);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to set expiration",
          code: "CACHE_EXPIRE_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          key: fullKey,
          ttl,
          message: `Expiration set to ${ttl} seconds`,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // Session Management Methods

  /**
   * Create session
   */
  public createSession = async (
    request: FastifyRequest<{
      Body: CreateSessionRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { sessionId, data, options } = request.body;
      const ttl = options?.ttl || 86400; // 24 hours default

      // Ensure data has required fields for session with proper type checking
      const sessionData = {
        userId: String(data.userId || ""),
        tenantId: String(data.tenantId || "default"),
        role: String(data.role || ""),
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        lastActivity: data.lastActivity
          ? typeof data.lastActivity === "string"
            ? new Date(data.lastActivity)
            : new Date(String(data.lastActivity))
          : new Date(),
      };

      const result = await this.cacheService.createSession(
        sessionId,
        sessionData,
        ttl
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to create session",
          code: "SESSION_CREATE_FAILED",
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          sessionId,
          ttl,
          message: "Session created successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get session data
   */
  public getSession = async (
    request: FastifyRequest<{
      Params: SessionParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { sessionId } = request.params;

      if (!sessionId) {
        return reply.status(400).send({
          status: "error",
          message: "Session ID is required",
        });
      }

      const sessionData = await this.cacheService.getSession(sessionId);

      if (!sessionData) {
        return reply.status(404).send({
          status: "error",
          message: "Session not found",
          code: "SESSION_NOT_FOUND",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          sessionId,
          data: sessionData,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Update session data
   */
  public updateSession = async (
    request: FastifyRequest<{
      Body: UpdateSessionRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { sessionId, data, extendTtl } = request.body;
      const ttl = extendTtl ? 86400 : undefined; // Extend for 24 hours if requested

      // Process data for session update with proper type checking
      const processedData: Partial<SessionData> = {};

      if (data.userId) {
        processedData.userId = String(data.userId);
      }
      if (data.tenantId) {
        processedData.tenantId = String(data.tenantId);
      }
      if (data.role) {
        processedData.role = String(data.role);
      }
      if (data.permissions) {
        processedData.permissions = Array.isArray(data.permissions)
          ? data.permissions.map((p) => String(p))
          : [];
      }
      if (data.lastActivity) {
        try {
          processedData.lastActivity = new Date(String(data.lastActivity));
        } catch {
          processedData.lastActivity = new Date();
        }
      }

      const result = await this.cacheService.updateSession(
        sessionId,
        processedData as Partial<SessionData>,
        ttl
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to update session",
          code: "SESSION_UPDATE_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          sessionId,
          message: "Session updated successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Delete session
   */
  public deleteSession = async (
    request: FastifyRequest<{
      Params: SessionParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { sessionId } = request.params;

      if (!sessionId) {
        return reply.status(400).send({
          status: "error",
          message: "Session ID is required",
        });
      }

      const result = await this.cacheService.deleteSession(sessionId);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to delete session",
          code: "SESSION_DELETE_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          sessionId,
          message: "Session deleted successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // Administration Methods

  /**
   * Get cache statistics
   */
  public getCacheStats = async (
    _request: FastifyRequest<{
      Querystring: CacheStatsQuery;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const stats = await this.cacheService.getStats();

      return reply.status(200).send({
        status: "success",
        data: {
          stats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Cache health check
   */
  public getCacheHealth = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const isHealthy = await this.cacheService.healthCheck();

      return reply.status(isHealthy ? 200 : 503).send({
        status: isHealthy ? "success" : "error",
        data: {
          healthy: isHealthy,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return reply.status(503).send({
        status: "error",
        message: "Cache health check failed",
        code: "HEALTH_CHECK_FAILED",
      });
    }
  };

  /**
   * Warm cache with data
   */
  public warmCache = async (
    request: FastifyRequest<{
      Body: {
        entries: Array<{ key: string; value: any; ttl?: number }>;
        namespace?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // Check if user has admin privileges
      const userId = (request as any).user?._id;
      const userRole = (request as any).user?.role;

      if (!userId || userRole !== "admin") {
        return reply.status(403).send({
          status: "error",
          message: "Insufficient permissions to warm cache",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      const { entries, namespace } = request.body;
      const processedEntries = entries.map((entry) => ({
        ...entry,
        key: namespace ? `${namespace}:${entry.key}` : entry.key,
      }));

      const result = await this.cacheService.warmCache(processedEntries);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to warm cache",
          code: "CACHE_WARM_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          entriesWarmed: entries.length,
          message: "Cache warmed successfully",
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };
}
