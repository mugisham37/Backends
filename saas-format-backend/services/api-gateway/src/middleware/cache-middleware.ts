import type { Request, Response, NextFunction } from "express"
import redisClient from "../utils/redis-client"
import { logger } from "../utils/logger"

export const cacheMiddleware = (prefix: string, ttl = 60) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== "GET") {
      return next()
    }

    try {
      // Create a cache key based on the URL and tenant
      const tenantId = req.tenant?.id || "public"
      const cacheKey = `${prefix}:${tenantId}:${req.originalUrl}`

      // Try to get cached response
      const cachedResponse = await redisClient.get(cacheKey)

      if (cachedResponse) {
        // Return cached response
        const parsedResponse = JSON.parse(cachedResponse)
        return res.status(200).json(parsedResponse)
      }

      // If no cache, store the response
      const originalSend = res.send
      res.send = function (body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            redisClient.set(cacheKey, body, "EX", ttl)
          } catch (error) {
            logger.error(`Cache error: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        return originalSend.call(this, body)
      } as any

      next()
    } catch (error) {
      // If caching fails, just continue without caching
      logger.error(`Cache middleware error: ${error instanceof Error ? error.message : String(error)}`)
      next()
    }
  }
}
