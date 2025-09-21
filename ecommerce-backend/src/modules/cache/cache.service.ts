import type { Redis } from "ioredis";
import { getRedisClient } from "./redis.client.js";

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  tags?: string[]; // For cache invalidation by tags
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export class CacheService {
  private redis: Redis;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  constructor() {
    // This will now use the fallback mock client if Redis is not available
    this.redis = getRedisClient();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, prefix);
      const value = await this.redis.get(fullKey);

      if (value === null) {
        this.metrics.misses++;
        this.updateHitRate();
        return null;
      }

      this.metrics.hits++;
      this.updateHitRate();
      return JSON.parse(value) as T;
    } catch (error) {
      console.error("Cache get error:", error);
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const { ttl = 3600, prefix, tags = [] } = options;
      const fullKey = this.buildKey(key, prefix);
      const serializedValue = JSON.stringify(value);

      // Set the main cache entry
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serializedValue);
      } else {
        await this.redis.set(fullKey, serializedValue);
      }

      // Store tags for invalidation
      if (tags.length > 0) {
        await this.storeTags(fullKey, tags, ttl);
      }

      this.metrics.sets++;
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options.prefix);

    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Delete single key
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, prefix);
      const result = await this.redis.del(fullKey);

      if (result > 0) {
        this.metrics.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string, prefix?: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, prefix);
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.metrics.deletes += result;
      return result;
    } catch (error) {
      console.error("Cache delete pattern error:", error);
      return 0;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys associated with this tag
          const deleted = await this.redis.del(...keys);
          totalDeleted += deleted;

          // Remove the tag set
          await this.redis.del(tagKey);
        }
      }

      this.metrics.deletes += totalDeleted;
      return totalDeleted;
    } catch (error) {
      console.error("Cache invalidate by tags error:", error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, prefix);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error("Cache exists error:", error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string, prefix?: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key, prefix);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      console.error("Cache TTL error:", error);
      return -1;
    }
  }

  /**
   * Extend TTL for a key
   */
  async extendTTL(key: string, ttl: number, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, prefix);
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error("Cache extend TTL error:", error);
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(
    key: string,
    by: number = 1,
    prefix?: string
  ): Promise<number> {
    try {
      const fullKey = this.buildKey(key, prefix);
      return await this.redis.incrby(fullKey, by);
    } catch (error) {
      console.error("Cache increment error:", error);
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decrement(
    key: string,
    by: number = 1,
    prefix?: string
  ): Promise<number> {
    try {
      const fullKey = this.buildKey(key, prefix);
      return await this.redis.decrby(fullKey, by);
    } catch (error) {
      console.error("Cache decrement error:", error);
      return 0;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      this.resetMetrics();
      return true;
    } catch (error) {
      console.error("Cache clear error:", error);
      return false;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Get cache info
   */
  async getInfo(): Promise<{
    memory: string;
    keys: number;
    metrics: CacheMetrics;
  }> {
    try {
      const info = await this.redis.info("memory");
      const dbSize = await this.redis.dbsize();

      return {
        memory: info,
        keys: dbSize,
        metrics: this.getMetrics(),
      };
    } catch (error) {
      console.error("Cache info error:", error);
      return {
        memory: "unavailable",
        keys: 0,
        metrics: this.getMetrics(),
      };
    }
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    if (prefix) {
      return `${prefix}:${key}`;
    }
    return key;
  }

  /**
   * Store tags for cache invalidation
   */
  private async storeTags(
    key: string,
    tags: string[],
    ttl: number
  ): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        await this.redis.sadd(tagKey, key);

        // Set TTL for tag set (slightly longer than cache entry)
        if (ttl > 0) {
          await this.redis.expire(tagKey, ttl + 300); // 5 minutes buffer
        }
      }
    } catch (error) {
      console.error("Store tags error:", error);
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }
}

// Singleton instance
export const cacheService = new CacheService();
