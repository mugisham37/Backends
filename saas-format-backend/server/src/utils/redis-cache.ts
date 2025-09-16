import { createClient, type RedisClientType } from "redis"
import { logger } from "./logger"
import { recordCacheHit, recordCacheMiss } from "./metrics"
import { config } from "../config"

// Redis client
let redisClient: RedisClientType

// Initialize Redis client
export const initRedisClient = async (): Promise<RedisClientType> => {
  if (redisClient) {
    return redisClient
  }

  redisClient = createClient({
    url: config.redis.url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error("Redis reconnection attempts exceeded. Giving up.")
          return new Error("Redis reconnection attempts exceeded")
        }
        // Exponential backoff with jitter
        const delay = Math.min(Math.pow(2, retries) * 100, 30000)
        const jitter = Math.random() * 100
        return delay + jitter
      },
    },
  })

  redisClient.on("error", (err) => {
    logger.error("Redis error:", err)
  })

  redisClient.on("connect", () => {
    logger.info("Connected to Redis")
  })

  redisClient.on("reconnecting", () => {
    logger.info("Reconnecting to Redis")
  })

  await redisClient.connect()
  return redisClient
}

// Get Redis client
export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error("Redis client not initialized")
  }
  return redisClient
}

// Close Redis client
export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit()
    logger.info("Redis client closed")
  }
}

// Cache key prefix
const CACHE_PREFIX = "saas:"

// Generate cache key
export const generateCacheKey = (key: string): string => {
  return `${CACHE_PREFIX}${key}`
}

// Set cache with TTL
export const setCache = async <T>(\
  key: string,
  value: T,
  ttlSeconds = 3600
)
: Promise<void> =>
{
  try {
    const client = getRedisClient()
    const cacheKey = generateCacheKey(key)
    await client.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds })
    logger.debug(`Cache set: ${cacheKey}`)
  } catch (error) {
    logger.error(`Error setting cache for key ${key}:`, error)
  }
}

// Get cache
export const getCache = async <T>(key: string)
: Promise<T | null> =>
{
  try {
    const client = getRedisClient()
    const cacheKey = generateCacheKey(key)
    const cachedValue = await client.get(cacheKey)

    if (cachedValue) {
      recordCacheHit("redis")
      logger.debug(`Cache hit: ${cacheKey}`)
      return JSON.parse(cachedValue) as T;
    }

    recordCacheMiss("redis")
    logger.debug(`Cache miss: ${cacheKey}`)
    return null;
  } catch (error) {
    logger.error(`Error getting cache for key ${key}:`, error)
    return null;
  }
}

// Delete cache
export const deleteCache = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient()
    const cacheKey = generateCacheKey(key)
    await client.del(cacheKey)
    logger.debug(`Cache deleted: ${cacheKey}`)
  } catch (error) {
    logger.error(`Error deleting cache for key ${key}:`, error)
  }
}

// Delete cache by pattern
export const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  try {
    const client = getRedisClient()
    const cachePattern = generateCacheKey(pattern)
    const keys = await client.keys(cachePattern)

    if (keys.length > 0) {
      await client.del(keys)
      logger.debug(`Cache deleted by pattern: ${cachePattern}, ${keys.length} keys removed`)
    }
  } catch (error) {
    logger.error(`Error deleting cache by pattern ${pattern}:`, error)
  }
}

// Cache wrapper function
export const withCache = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 3600
)
: Promise<T> =>
{
  // Try to get from cache first
  const cachedValue = await getCache<T>(key)

  if (cachedValue !== null) {
    return cachedValue;
  }

  // If not in cache, fetch the data
  const fetchedValue = await fetchFn()

  // Store in cache for future requests
  await setCache(key, fetchedValue, ttlSeconds)

  return fetchedValue;
}

// Invalidate cache for a specific entity
export const invalidateEntityCache = async (entityType: string, entityId: string): Promise<void> => {
  await deleteCacheByPattern(`${entityType}:${entityId}:*`)
  await deleteCacheByPattern(`${entityType}:list:*`)
}

export default {
  initRedisClient,
  getRedisClient,
  closeRedisClient,
  setCache,
  getCache,
  deleteCache,
  deleteCacheByPattern,
  withCache,
  invalidateEntityCache,
}
