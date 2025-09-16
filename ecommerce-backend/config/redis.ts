import { createClient, type RedisClientType } from "redis"
import logger from "./logger"

// Redis client type
let redisClient: RedisClientType

// Connection status
let isConnecting = false
let connectionAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_DELAY_MS = 5000

/**
 * Create Redis client
 * @returns Redis client
 */
const createRedisClient = (): RedisClientType => {
  return createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with max delay of 30 seconds
        const delay = Math.min(Math.pow(2, retries) * 100, 30000)
        logger.info(`Redis reconnecting in ${delay}ms... (attempt ${retries + 1})`)
        return delay
      },
      connectTimeout: 10000, // 10 seconds
    },
  })
}

/**
 * Connect to Redis
 * @returns Promise that resolves when connected
 */
export const connectRedis = async (): Promise<void> => {
  if (isConnecting) {
    logger.debug("Redis connection already in progress")
    return
  }

  isConnecting = true
  connectionAttempts++

  try {
    // Create client if it doesn't exist
    if (!redisClient) {
      redisClient = createRedisClient()

      // Set up event handlers
      redisClient.on("connect", () => {
        logger.info("Redis client connected")
        connectionAttempts = 0
      })

      redisClient.on("error", (err) => {
        logger.error(`Redis client error: ${err.message}`)
      })

      redisClient.on("reconnecting", () => {
        logger.info("Redis client reconnecting")
      })

      redisClient.on("end", () => {
        logger.info("Redis client disconnected")
      })
    }

    // Connect to Redis
    await redisClient.connect()
    isConnecting = false
  } catch (error) {
    isConnecting = false
    logger.error(`Failed to connect to Redis: ${error.message}`)

    // Retry connection if not exceeded max attempts
    if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(Math.pow(2, connectionAttempts) * 100, 30000)
      logger.info(`Retrying Redis connection in ${delay}ms... (attempt ${connectionAttempts})`)

      setTimeout(() => {
        connectRedis().catch((err) => {
          logger.error(`Redis reconnection failed: ${err.message}`)
        })
      }, delay)
    } else {
      logger.error(`Max Redis connection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`)
    }
  }
}

/**
 * Get Redis client
 * @returns Redis client
 */
export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    logger.warn("Redis client requested before initialization")
    redisClient = createRedisClient()
    connectRedis().catch((err) => {
      logger.error(`Redis connection failed: ${err.message}`)
    })
  }
  return redisClient
}

/**
 * Check if Redis is connected
 * @returns True if connected, false otherwise
 */
export const isRedisConnected = (): boolean => {
  return redisClient?.isOpen || false
}

/**
 * Set a value in Redis with optional expiration
 * @param key Redis key
 * @param value Value to store
 * @param expireInSeconds Expiration time in seconds
 */
export const setCache = async (key: string, value: any, expireInSeconds?: number): Promise<void> => {
  try {
    const client = getRedisClient()

    if (!client.isOpen) {
      logger.warn("Redis client not connected, attempting to reconnect")
      await connectRedis()

      // If still not connected, return without throwing error
      if (!client.isOpen) {
        logger.warn("Redis still not connected, skipping cache operation")
        return
      }
    }

    const stringValue = typeof value === "string" ? value : JSON.stringify(value)

    if (expireInSeconds) {
      await client.setEx(key, expireInSeconds, stringValue)
    } else {
      await client.set(key, stringValue)
    }
  } catch (error) {
    logger.error(`Redis setCache error: ${error.message}`)
    // Don't throw error to prevent application failure if Redis is down
  }
}

/**
 * Get a value from Redis
 * @param key Redis key
 * @returns Stored value or null if not found
 */ \
export const getCache = async <T>(key: string)
: Promise<T | null> =>
{
  try {
    const client = getRedisClient()

    if (!client.isOpen) {
      logger.warn("Redis client not connected, attempting to reconnect")
      await connectRedis()

      // If still not connected, return null without throwing error
      if (!client.isOpen) {
        logger.warn("Redis still not connected, skipping cache operation")
        return null
      }
    }

    const value = await client.get(key)

    if (!value) {
      return null
    }

    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  } catch (error) {
    logger.error(`Redis getCache error: ${error.message}`)
    return null
  }
}

/**
 * Delete a value from Redis
 * @param key Redis key
 */
export const deleteCache = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient()

    if (!client.isOpen) {
      logger.warn("Redis client not connected, attempting to reconnect")
      await connectRedis()

      // If still not connected, return without throwing error
      if (!client.isOpen) {
        logger.warn("Redis still not connected, skipping cache operation")
        return
      }
    }

    await client.del(key)
  } catch (error) {
    logger.error(`Redis deleteCache error: ${error.message}`)
  }
}

/**
 * Delete multiple values from Redis using pattern
 * @param pattern Redis key pattern
 */
export const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  try {
    const client = getRedisClient()

    if (!client.isOpen) {
      logger.warn("Redis client not connected, attempting to reconnect")
      await connectRedis()

      // If still not connected, return without throwing error
      if (!client.isOpen) {
        logger.warn("Redis still not connected, skipping cache operation")
        return
      }
    }

    const keys = await client.keys(pattern)

    if (keys.length > 0) {
      await client.del(keys)
      logger.info(`Deleted ${keys.length} keys matching pattern: ${pattern}`)
    }
  } catch (error) {
    logger.error(`Redis deleteCacheByPattern error: ${error.message}`)
  }
}

/**
 * Gracefully close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit()
      logger.info("Redis connection closed gracefully")
    } catch (error) {
      logger.error(`Error closing Redis connection: ${error.message}`)
    }
  }
}

// Initialize Redis connection
connectRedis().catch((err) => {
  logger.error(`Initial Redis connection failed: ${err.message}`)
})

export default getRedisClient()
