import Redis from "ioredis";
import { injectable } from "tsyringe";
import { config } from "../../shared/config/index";
import type { Result } from "../../core/types/result.types";
import { logger } from "../../shared/utils/logger";

/**
 * Caching service with Redis integration
 * Provides TTL management, cache invalidation strategies, and session management
 */
@injectable()
export class CacheService {
  private redis: Redis;
  private sessionRedis: Redis;
  private isConnected = false;

  constructor() {
    // Main Redis connection for caching
    this.redis = new Redis(config.redis.uri, {
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    // Separate Redis connection for sessions (different DB)
    this.sessionRedis = new Redis(config.redis.uri, {
      password: config.redis.password,
      db: config.redis.db + 1, // Use different DB for sessions
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.setupEventHandlers();
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on("connect", () => {
      logger.info("Redis cache connection established");
      this.isConnected = true;
    });

    this.redis.on("error", (error) => {
      logger.error("Redis cache connection error:", error);
      this.isConnected = false;
    });

    this.redis.on("close", () => {
      logger.warn("Redis cache connection closed");
      this.isConnected = false;
    });

    this.sessionRedis.on("connect", () => {
      logger.info("Redis session connection established");
    });

    this.sessionRedis.on("error", (error) => {
      logger.error("Redis session connection error:", error);
    });
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      await Promise.all([this.redis.connect(), this.sessionRedis.connect()]);
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        logger.warn("Redis not connected, skipping cache get");
        return null;
      }

      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = config.cache.ttl
  ): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        logger.warn("Redis not connected, skipping cache set");
        return { success: false, error: new Error("Redis not connected") };
      }

      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return {
        success: false,
        error: new Error("Failed to set cache value"),
      };
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        logger.warn("Redis not connected, skipping cache delete");
        return { success: false, error: new Error("Redis not connected") };
      }

      await this.redis.del(key);
      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return {
        success: false,
        error: new Error("Failed to delete cache value"),
      };
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        logger.warn("Redis not connected, skipping cache clear");
        return { success: false, error: new Error("Redis not connected") };
      }

      await this.redis.flushdb();
      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Cache clear error:", error);
      return {
        success: false,
        error: new Error("Failed to clear cache"),
      };
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.isConnected || keys.length === 0) {
        return keys.map(() => null);
      }

      const values = await this.redis.mget(...keys);
      return values.map((value) => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error("Cache mget error:", error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        return { success: false, error: new Error("Redis not connected") };
      }

      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const ttl = entry.ttl || config.cache.ttl;
        pipeline.setex(entry.key, ttl, serialized);
      }

      await pipeline.exec();
      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Cache mset error:", error);
      return {
        success: false,
        error: new Error("Failed to set multiple cache values"),
      };
    }
  }

  /**
   * Increment numeric value in cache
   */
  async increment(key: string, amount = 1): Promise<Result<number, Error>> {
    try {
      if (!this.isConnected) {
        return { success: false, error: new Error("Redis not connected") };
      }

      const newValue = await this.redis.incrby(key, amount);
      return { success: true, data: newValue };
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return {
        success: false,
        error: new Error("Failed to increment cache value"),
      };
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        return { success: false, error: new Error("Redis not connected") };
      }

      await this.redis.expire(key, ttlSeconds);
      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return {
        success: false,
        error: new Error("Failed to set expiration"),
      };
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      if (!this.isConnected) {
        return -1;
      }

      return await this.redis.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Cache invalidation by pattern
   */
  async invalidatePattern(pattern: string): Promise<Result<number, Error>> {
    try {
      if (!this.isConnected) {
        return { success: false, error: new Error("Redis not connected") };
      }

      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return { success: true, data: 0 };
      }

      const deleted = await this.redis.del(...keys);
      return { success: true, data: deleted };
    } catch (error) {
      logger.error(`Cache invalidate pattern error for ${pattern}:`, error);
      return {
        success: false,
        error: new Error("Failed to invalidate cache pattern"),
      };
    }
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  async warmCache(
    entries: Array<{ key: string; value: any; ttl?: number }>
  ): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        return { success: false, error: new Error("Redis not connected") };
      }

      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const ttl = entry.ttl || config.cache.ttl;
        pipeline.setex(entry.key, ttl, serialized);
      }

      await pipeline.exec();
      logger.info(`Cache warmed with ${entries.length} entries`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Cache warming error:", error);
      return {
        success: false,
        error: new Error("Failed to warm cache"),
      };
    }
  }

  // Session Management Methods

  /**
   * Create session
   */
  async createSession(
    sessionId: string,
    data: any,
    ttlSeconds = 86400 // 24 hours
  ): Promise<Result<void, Error>> {
    try {
      const serialized = JSON.stringify(data);
      await this.sessionRedis.setex(
        `session:${sessionId}`,
        ttlSeconds,
        serialized
      );

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Session create error for ${sessionId}:`, error);
      return {
        success: false,
        error: new Error("Failed to create session"),
      };
    }
  }

  /**
   * Get session data
   */
  async getSession<T>(sessionId: string): Promise<T | null> {
    try {
      const data = await this.sessionRedis.get(`session:${sessionId}`);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Session get error for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string,
    data: any,
    ttlSeconds?: number
  ): Promise<Result<void, Error>> {
    try {
      const serialized = JSON.stringify(data);

      if (ttlSeconds) {
        await this.sessionRedis.setex(
          `session:${sessionId}`,
          ttlSeconds,
          serialized
        );
      } else {
        // Keep existing TTL
        const currentTTL = await this.sessionRedis.ttl(`session:${sessionId}`);
        if (currentTTL > 0) {
          await this.sessionRedis.setex(
            `session:${sessionId}`,
            currentTTL,
            serialized
          );
        } else {
          await this.sessionRedis.set(`session:${sessionId}`, serialized);
        }
      }

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Session update error for ${sessionId}:`, error);
      return {
        success: false,
        error: new Error("Failed to update session"),
      };
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<Result<void, Error>> {
    try {
      await this.sessionRedis.del(`session:${sessionId}`);
      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Session delete error for ${sessionId}:`, error);
      return {
        success: false,
        error: new Error("Failed to delete session"),
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          keyCount: 0,
          memoryUsage: "0B",
        };
      }

      const info = await this.redis.info("memory");
      const keyCount = await this.redis.dbsize();

      // Extract memory usage from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : "Unknown";

      return {
        connected: true,
        keyCount,
        memoryUsage,
      };
    } catch (error) {
      logger.error("Failed to get cache stats:", error);
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: "0B",
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === "PONG";
    } catch (error) {
      logger.error("Cache health check failed:", error);
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.disconnect(),
        this.sessionRedis.disconnect(),
      ]);
      this.isConnected = false;
      logger.info("Disconnected from Redis");
    } catch (error) {
      logger.error("Error disconnecting from Redis:", error);
    }
  }
}
