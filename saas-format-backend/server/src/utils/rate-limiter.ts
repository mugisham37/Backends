import type { Request, Response, NextFunction } from "express"
import { RateLimiterRedis } from "rate-limiter-flexible"
import { getRedisClient } from "./redis-cache"
import { logger } from "./logger"
import { ApiError } from "./api-error"
import { config } from "../config"

// Rate limiter options
interface RateLimiterOptions {
  points: number
  duration: number
  blockDuration?: number
  keyPrefix?: string
}

// Create a rate limiter
export const createRateLimiter = async (options: RateLimiterOptions): Promise<RateLimiterRedis> => {
  try {
    const redisClient = getRedisClient()

    return new RateLimiterRedis({
      storeClient: redisClient,
      points: options.points, // Number of points
      duration: options.duration, // Per seconds
      blockDuration: options.blockDuration, // Block duration in seconds
      keyPrefix: options.keyPrefix || "rlflx", // Key prefix in Redis
    })
  } catch (error) {
    logger.error("Error creating rate limiter:", error)
    throw error
  }
}

// Default rate limiters
let apiLimiter: RateLimiterRedis
let authLimiter: RateLimiterRedis

// Initialize rate limiters
export const initRateLimiters = async (): Promise<void> => {
  try {
    // General API rate limiter
    apiLimiter = await createRateLimiter({
      points: config.security.rateLimiting.max,
      duration: config.security.rateLimiting.windowMs / 1000,
      keyPrefix: "rl:api",
    })

    // Authentication rate limiter (more strict)
    authLimiter = await createRateLimiter({
      points: 5, // 5 attempts
      duration: 60, // Per minute
      blockDuration: 300, // Block for 5 minutes after too many attempts
      keyPrefix: "rl:auth",
    })

    logger.info("Rate limiters initialized")
  } catch (error) {
    logger.error("Error initializing rate limiters:", error)
    throw error
  }
}

// Get client IP
export const getClientIp = (req: Request): string => {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown"
}

// API rate limiter middleware
export const apiRateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!config.security.rateLimiting.enabled) {
    return next()
  }

  try {
    // Get tenant ID from header or default to 'global'
    const tenantId = (req.headers["x-tenant-id"] as string) || "global"

    // Get client IP
    const clientIp = getClientIp(req)

    // Create a composite key: tenantId:ip
    const key = `${tenantId}:${clientIp}`

    // Check rate limit
    await apiLimiter.consume(key)
    next()
  } catch (error) {
    if (error.name === "Error") {
      // Rate limit exceeded
      logger.warn(`API rate limit exceeded for IP: ${getClientIp(req)}`)

      // Set rate limit headers
      res.set("Retry-After", String(Math.ceil(error.msBeforeNext / 1000)))

      // Return rate limit error
      next(new ApiError("Too many requests, please try again later", 429))
    } else {
      // Unexpected error
      logger.error("Rate limiter error:", error)
      next(new ApiError("Internal server error", 500))
    }
  }
}

// Authentication rate limiter middleware
export const authRateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!config.security.rateLimiting.enabled) {
    return next()
  }

  try {
    // Get client IP
    const clientIp = getClientIp(req)

    // Get username or email from request body
    const username = req.body.email || req.body.username || "unknown"

    // Create composite keys
    const ipKey = `ip:${clientIp}`
    const usernameKey = `user:${username}`

    // Check rate limit for IP
    await authLimiter.consume(ipKey)

    // Check rate limit for username
    await authLimiter.consume(usernameKey)

    next()
  } catch (error) {
    if (error.name === "Error") {
      // Rate limit exceeded
      logger.warn(`Auth rate limit exceeded for IP: ${getClientIp(req)}`)

      // Set rate limit headers
      res.set("Retry-After", String(Math.ceil(error.msBeforeNext / 1000)))

      // Return rate limit error
      next(new ApiError("Too many login attempts, please try again later", 429))
    } else {
      // Unexpected error
      logger.error("Rate limiter error:", error)
      next(new ApiError("Internal server error", 500))
    }
  }
}

// Custom rate limiter middleware factory
export const createRateLimiterMiddleware = (limiter: RateLimiterRedis, keyGenerator: (req: Request) => string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.security.rateLimiting.enabled) {
      return next()
    }

    try {
      // Generate key
      const key = keyGenerator(req)

      // Check rate limit
      await limiter.consume(key)
      next()
    } catch (error) {
      if (error.name === "Error") {
        // Rate limit exceeded
        logger.warn(`Rate limit exceeded for key: ${keyGenerator(req)}`)

        // Set rate limit headers
        res.set("Retry-After", String(Math.ceil(error.msBeforeNext / 1000)))

        // Return rate limit error
        next(new ApiError("Too many requests, please try again later", 429))
      } else {
        // Unexpected error
        logger.error("Rate limiter error:", error)
        next(new ApiError("Internal server error", 500))
      }
    }
  }
}

export default {
  createRateLimiter,
  initRateLimiters,
  apiRateLimiterMiddleware,
  authRateLimiterMiddleware,
  createRateLimiterMiddleware,
  getClientIp,
}
