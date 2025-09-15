import { createClient, type RedisClientType } from "redis";
import { config } from "../config";
import { logger } from "../utils/logger";

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client
 */
export const initializeRedis = async (): Promise<void> => {
  if (!config.redis.enabled) {
    logger.info("Redis is disabled, skipping initialization");
    return;
  }

  try {
    logger.info("Connecting to Redis...");

    // Create Redis client
    redisClient = createClient({
      url: config.redis.uri,
      password: config.redis.password,
    });

    // Set up event handlers
    redisClient.on("error", (err) => {
      logger.error("Redis error:", err);
    });

    redisClient.on("connect", () => {
      logger.info("Connected to Redis");
    });

    redisClient.on("reconnecting", () => {
      logger.info("Reconnecting to Redis...");
    });

    redisClient.on("end", () => {
      logger.info("Redis connection closed");
    });

    // Connect to Redis
    await redisClient.connect();
  } catch (error) {
    logger.error("Failed to connect to Redis:", error);
    throw error;
  }
};

/**
 * Get Redis client
 */
export const getCacheClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error("Redis client not initialized");
  }
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed");
  }
};

/**
 * Cache wrapper for expensive operations
 */
export const withCache = async <T>(
  key: string,
  operation: () => Promise<T>,
  options: {
    ttl?: number; // Time to live in seconds
    refreshCache?: boolean; // Force refresh cache
  } = {}
): Promise<T> => {
  if (!config.redis.enabled || !redisClient) {
    return operation();
  }

  const { ttl = 3600, refreshCache = false } = options;

  try {
    // If refresh is requested, skip cache lookup
    if (!refreshCache) {
      // Try to get from cache
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return JSON.parse(cachedData) as T;
      }
    }

    // Execute operation
    const result = await operation();

    // Store in cache
    await redisClient.set(key, JSON.stringify(result), {
      EX: ttl,
    });

    return result;
  } catch (error) {
    logger.error(`Cache error for key ${key}:`, error);
    // Fall back to operation without caching
    return operation();
  }
};

/**
 * Invalidate cache for a key or pattern
 */
export const invalidateCache = async (keyOrPattern: string): Promise<void> => {
  if (!config.redis.enabled || !redisClient) {
    return;
  }

  try {
    if (keyOrPattern.includes("*")) {
      // Pattern matching - get all matching keys and delete them
      const keys = await redisClient.keys(keyOrPattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug(
          `Invalidated ${keys.length} cache keys matching pattern: ${keyOrPattern}`
        );
      }
    } else {
      // Single key
      await redisClient.del(keyOrPattern);
      logger.debug(`Invalidated cache key: ${keyOrPattern}`);
    }
  } catch (error) {
    logger.error(`Error invalidating cache for ${keyOrPattern}:`, error);
  }
};
