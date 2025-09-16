/**
 * Cache Module
 *
 * Provides comprehensive caching functionality including:
 * - Redis client connection management
 * - Intelligent cache service with invalidation
 * - Multi-level caching strategies
 * - Cache decorators for easy integration
 * - Performance monitoring and metrics
 */

// Core cache functionality
export {
  redisClient,
  getRedisClient,
  initializeRedis,
  closeRedis,
} from "./redis.client.js";
export {
  cacheService,
  type CacheOptions,
  type CacheMetrics,
} from "./cache.service.js";

// Caching strategies
export {
  multiLevelCache,
  cacheWarmer,
  CacheStrategies,
  CacheHelpers,
  type CacheStrategy,
  MultiLevelCache,
  CacheWarmer,
} from "./cache.strategies.js";

// Cache decorators
export {
  Cache,
  CacheClass,
  CacheInvalidate,
  CacheWarm,
  RateLimit,
  Memoize,
  CacheDecoratorUtils,
  type CacheDecoratorOptions,
} from "../../core/decorators/cache.decorator.js";

// Performance monitoring
export {
  cacheMonitor,
  CacheMonitor,
  type CachePerformanceMetrics,
  type CacheAlert,
} from "./cache.monitor.js";

/**
 * Initialize the complete cache system
 */
export async function initializeCacheSystem(): Promise<void> {
  try {
    console.log("Initializing cache system...");

    // Initialize Redis connection
    const { initializeRedis } = await import("./redis.client.js");
    await initializeRedis();
    console.log("✅ Redis connection established");

    // Start cache monitoring
    const { cacheMonitor } = await import("./cache.monitor.js");
    cacheMonitor.startMonitoring(60000); // Monitor every minute
    console.log("✅ Cache monitoring started");

    // Warm up cache with critical data
    const { cacheWarmer } = await import("./cache.strategies.js");
    await cacheWarmer.warmUp();
    console.log("✅ Cache warm-up completed");

    console.log("🚀 Cache system initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize cache system:", error);
    throw error;
  }
}

/**
 * Shutdown the cache system gracefully
 */
export async function shutdownCacheSystem(): Promise<void> {
  try {
    console.log("Shutting down cache system...");

    // Stop monitoring
    const { cacheMonitor } = await import("./cache.monitor.js");
    cacheMonitor.stopMonitoring();
    console.log("✅ Cache monitoring stopped");

    // Close Redis connection
    const { closeRedis } = await import("./redis.client.js");
    await closeRedis();
    console.log("✅ Redis connection closed");

    console.log("🔒 Cache system shutdown completed");
  } catch (error) {
    console.error("❌ Error during cache system shutdown:", error);
    throw error;
  }
}

/**
 * Get cache system health status
 */
export async function getCacheSystemHealth() {
  const { cacheMonitor } = await import("./cache.monitor.js");
  return cacheMonitor.getHealthStatus();
}

/**
 * Get cache system performance report
 */
export async function getCacheSystemReport(hours: number = 24) {
  const { cacheMonitor } = await import("./cache.monitor.js");
  return cacheMonitor.generateReport(hours);
}
