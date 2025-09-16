import { cacheService, type CacheOptions } from "./cache.service.js";

export interface CacheStrategy {
  name: string;
  ttl: number;
  tags?: string[];
  prefix?: string;
}

/**
 * Predefined caching strategies for different data types
 */
export const CacheStrategies = {
  // User data - medium TTL, user-specific invalidation
  USER: {
    name: "user",
    ttl: 3600, // 1 hour
    prefix: "user",
    tags: ["user"],
  } as CacheStrategy,

  // Product data - longer TTL, product-specific invalidation
  PRODUCT: {
    name: "product",
    ttl: 7200, // 2 hours
    prefix: "product",
    tags: ["product", "catalog"],
  } as CacheStrategy,

  // Vendor data - medium TTL, vendor-specific invalidation
  VENDOR: {
    name: "vendor",
    ttl: 3600, // 1 hour
    prefix: "vendor",
    tags: ["vendor"],
  } as CacheStrategy,

  // Order data - short TTL, order-specific invalidation
  ORDER: {
    name: "order",
    ttl: 1800, // 30 minutes
    prefix: "order",
    tags: ["order"],
  } as CacheStrategy,

  // Search results - short TTL, search-specific invalidation
  SEARCH: {
    name: "search",
    ttl: 900, // 15 minutes
    prefix: "search",
    tags: ["search", "catalog"],
  } as CacheStrategy,

  // Analytics data - longer TTL, analytics-specific invalidation
  ANALYTICS: {
    name: "analytics",
    ttl: 14400, // 4 hours
    prefix: "analytics",
    tags: ["analytics"],
  } as CacheStrategy,

  // Configuration data - very long TTL, config-specific invalidation
  CONFIG: {
    name: "config",
    ttl: 86400, // 24 hours
    prefix: "config",
    tags: ["config"],
  } as CacheStrategy,

  // Session data - short TTL, session-specific invalidation
  SESSION: {
    name: "session",
    ttl: 1800, // 30 minutes
    prefix: "session",
    tags: ["session"],
  } as CacheStrategy,

  // API responses - very short TTL, api-specific invalidation
  API_RESPONSE: {
    name: "api",
    ttl: 300, // 5 minutes
    prefix: "api",
    tags: ["api"],
  } as CacheStrategy,

  // Static content - very long TTL
  STATIC: {
    name: "static",
    ttl: 604800, // 7 days
    prefix: "static",
    tags: ["static"],
  } as CacheStrategy,
};

/**
 * Multi-level cache implementation
 * L1: In-memory cache (fastest, smallest)
 * L2: Redis cache (fast, larger)
 * L3: Database (slowest, largest)
 */
export class MultiLevelCache {
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  private readonly maxMemoryEntries = 1000;
  private readonly memoryTTL = 300; // 5 minutes for memory cache

  /**
   * Get value with multi-level caching
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    strategy: CacheStrategy
  ): Promise<T> {
    const fullKey = `${strategy.prefix}:${key}`;

    // L1: Check memory cache
    const memoryResult = this.getFromMemory<T>(fullKey);
    if (memoryResult !== null) {
      return memoryResult;
    }

    // L2: Check Redis cache
    const redisResult = await cacheService.get<T>(key, strategy.prefix);
    if (redisResult !== null) {
      // Store in memory cache for faster access
      this.setInMemory(fullKey, redisResult);
      return redisResult;
    }

    // L3: Fetch from source (database, API, etc.)
    const value = await fetcher();

    // Store in both caches
    await this.set(key, value, strategy);
    this.setInMemory(fullKey, value);

    return value;
  }

  /**
   * Set value in multi-level cache
   */
  async set<T>(key: string, value: T, strategy: CacheStrategy): Promise<void> {
    const fullKey = `${strategy.prefix}:${key}`;

    // Set in Redis
    await cacheService.set(key, value, {
      ttl: strategy.ttl,
      prefix: strategy.prefix,
      tags: strategy.tags,
    });

    // Set in memory
    this.setInMemory(fullKey, value);
  }

  /**
   * Delete from multi-level cache
   */
  async delete(key: string, strategy: CacheStrategy): Promise<void> {
    const fullKey = `${strategy.prefix}:${key}`;

    // Delete from Redis
    await cacheService.delete(key, strategy.prefix);

    // Delete from memory
    this.memoryCache.delete(fullKey);
  }

  /**
   * Invalidate by tags across all levels
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    // Invalidate Redis cache
    await cacheService.invalidateByTags(tags);

    // Invalidate memory cache (simple approach - clear all)
    // In production, you might want a more sophisticated approach
    this.memoryCache.clear();
  }

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set in memory cache with size limit
   */
  private setInMemory<T>(key: string, value: T): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + this.memoryTTL * 1000,
    });
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    await cacheService.clear();
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.maxMemoryEntries,
      },
      redis: cacheService.getMetrics(),
    };
  }
}

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  constructor(private cache: MultiLevelCache) {}

  /**
   * Warm up frequently accessed data
   */
  async warmUp(): Promise<void> {
    console.log("Starting cache warm-up...");

    try {
      // Warm up critical configuration
      await this.warmUpConfig();

      // Warm up popular products
      await this.warmUpPopularProducts();

      // Warm up active vendors
      await this.warmUpActiveVendors();

      console.log("Cache warm-up completed");
    } catch (error) {
      console.error("Cache warm-up failed:", error);
    }
  }

  private async warmUpConfig(): Promise<void> {
    // Implementation would depend on your config structure
    console.log("Warming up configuration cache...");
  }

  private async warmUpPopularProducts(): Promise<void> {
    // Implementation would fetch popular products and cache them
    console.log("Warming up popular products cache...");
  }

  private async warmUpActiveVendors(): Promise<void> {
    // Implementation would fetch active vendors and cache them
    console.log("Warming up active vendors cache...");
  }
}

// Singleton instances
export const multiLevelCache = new MultiLevelCache();
export const cacheWarmer = new CacheWarmer(multiLevelCache);

/**
 * Helper functions for common caching patterns
 */
export const CacheHelpers = {
  /**
   * Cache user data
   */
  async cacheUser<T>(userId: string, fetcher: () => Promise<T>): Promise<T> {
    return multiLevelCache.get(`user:${userId}`, fetcher, CacheStrategies.USER);
  },

  /**
   * Cache product data
   */
  async cacheProduct<T>(
    productId: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return multiLevelCache.get(
      `product:${productId}`,
      fetcher,
      CacheStrategies.PRODUCT
    );
  },

  /**
   * Cache vendor data
   */
  async cacheVendor<T>(
    vendorId: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return multiLevelCache.get(
      `vendor:${vendorId}`,
      fetcher,
      CacheStrategies.VENDOR
    );
  },

  /**
   * Cache search results
   */
  async cacheSearch<T>(query: string, fetcher: () => Promise<T>): Promise<T> {
    const searchKey = Buffer.from(query).toString("base64");
    return multiLevelCache.get(
      `search:${searchKey}`,
      fetcher,
      CacheStrategies.SEARCH
    );
  },

  /**
   * Invalidate user-related caches
   */
  async invalidateUser(userId: string): Promise<void> {
    await multiLevelCache.delete(`user:${userId}`, CacheStrategies.USER);
    await cacheService.invalidateByTags(["user"]);
  },

  /**
   * Invalidate product-related caches
   */
  async invalidateProduct(productId: string): Promise<void> {
    await multiLevelCache.delete(
      `product:${productId}`,
      CacheStrategies.PRODUCT
    );
    await cacheService.invalidateByTags(["product", "catalog", "search"]);
  },

  /**
   * Invalidate vendor-related caches
   */
  async invalidateVendor(vendorId: string): Promise<void> {
    await multiLevelCache.delete(`vendor:${vendorId}`, CacheStrategies.VENDOR);
    await cacheService.invalidateByTags(["vendor", "catalog"]);
  },
};
