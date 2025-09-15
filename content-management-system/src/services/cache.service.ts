import Redis from "ioredis"
import { config } from "../config"
import { logger } from "../utils/logger"

export class CacheService {
  private client: Redis | null = null
  private isEnabled: boolean

  constructor() {
    this.isEnabled = config.redis.enabled
    this.initialize()
  }

  /**
   * Initialize Redis connection
   */
  private initialize(): void {
    if (!this.isEnabled) {
      logger.info("Redis caching is disabled")
      return
    }

    try {
      const options: any = {}
      if (config.redis.password) {
        options.password = config.redis.password
      }

      this.client = new Redis(config.redis.uri, options)

      this.client.on("connect", () => {
        logger.info("Redis connected successfully")
      })

      this.client.on("error", (error) => {
        logger.error("Redis connection error:", error)
      })

      this.client.on("close", () => {
        logger.warn("Redis connection closed")
      })
    } catch (error) {
      logger.error("Failed to initialize Redis:", error)
      this.isEnabled = false
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) {
      return null
    }

    try {
      const value = await this.client.get(key)
      if (!value) {
        return null
      }

      return JSON.parse(value) as T
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error)
      return null
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false
    }

    try {
      const serializedValue = JSON.stringify(value)

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue)
      } else {
        await this.client.set(key, serializedValue)
      }

      return true
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error)
      return false
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false
    }

    try {
      await this.client.del(key)
      return true
    } catch (error) {
      logger.error(`Error deleting cache key ${key}:`, error)
      return false
    }
  }

  /**
   * Delete multiple values from cache by pattern
   */
  async deleteByPattern(pattern: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false
    }

    try {
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
      return true
    } catch (error) {
      logger.error(`Error deleting cache keys by pattern ${pattern}:`, error)
      return false
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false
    }

    try {
      const exists = await this.client.exists(key)
      return exists === 1
    } catch (error) {
      logger.error(`Error checking if cache key ${key} exists:`, error)
      return false
    }
  }

  /**
   * Set value in cache with hash
   */
  async hset(key: string, field: string, value: any): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false
    }

    try {
      const serializedValue = JSON.stringify(value)
      await this.client.hset(key, field, serializedValue)
      return true
    } catch (error) {
      logger.error(`Error setting hash cache key ${key} field ${field}:`, error)
      return false
    }
  }

  /**
   * Get value from cache with hash
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) {
      return null
    }

    try {
      const value = await this.client.hget(key, field)
      if (!value) {
        return null
      }

      return JSON.parse(value) as T
    } catch (error) {
      logger.error(`Error getting hash cache key ${key} field ${field}:`, error)
      return null
    }
  }

  /**
   * Get all values from cache with hash
   */
  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    if (!this.isEnabled || !this.client) {
      return null
    }

    try {
      const values = await this.client.hgetall(key)
      if (!values || Object.keys(values).length === 0) {
        return null
      }

      const result: Record<string, T> = {}
      for (const field in values) {
        result[field] = JSON.parse(values[field]) as T
      }

      return result
    } catch (error) {
      logger.error(`Error getting all hash cache key ${key}:`, error)
      return null
    }
  }

  /**
   * Delete field from hash
   */
  async hdel(key: string, field: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false
    }

    try {
      await this.client.hdel(key, field)
      return true
    } catch (error) {
      logger.error(`Error deleting hash cache key ${key} field ${field}:`, error)
      return false
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()
