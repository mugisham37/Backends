// Rate limit middleware for Express and Fastify compatibility
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import Redis from "ioredis";
import { config } from "../config/index.ts";
import { logger } from "../utils/logger.ts";

// Redis client for rate limiting
let redisClient: Redis | null = null;

// Initialize Redis client if Redis URI is configured
if (config.redis?.uri && config.redis.enabled) {
  try {
    const options: any = {
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      db: config.redis.db,
    };
    if (config.redis.password) {
      options.password = config.redis.password;
    }

    redisClient = new Redis(config.redis.uri, options);

    redisClient.on("error", (error: Error) => {
      logger.error("Redis rate limit error:", error);
    });

    redisClient.on("connect", () => {
      logger.info("Redis connected for rate limiting");
    });
  } catch (error) {
    logger.error("Failed to initialize Redis for rate limiting:", error);
    redisClient = null;
  }
}

// Simple in-memory rate limiting for backward compatibility
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Cleanup function to remove expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Create rate limiting middleware for Express
 */
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  const windowMs = options.windowMs || config.rateLimit.windowMs;
  const max = options.max || config.rateLimit.max;
  const message = options.message || "Too many requests";
  const keyGenerator =
    options.keyGenerator || ((req: Request) => req.ip || "unknown");

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let requestData = requestCounts.get(key);

    if (!requestData || requestData.resetTime <= now) {
      requestData = { count: 1, resetTime: now + windowMs };
      requestCounts.set(key, requestData);
      return next();
    }

    requestData.count++;

    if (requestData.count > max) {
      logger.warn(`Rate limit exceeded for ${key}`, {
        count: requestData.count,
        max,
        ip: req.ip,
      });

      return res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message,
          retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
        },
      });
    }

    next();
  };
};

// Create rate limiter using express-rate-limit (in-memory store)
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later.",
  },
});

// Create more restrictive rate limiter for auth routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many authentication attempts, please try again later.",
  },
});

// Export Redis client for use in other parts of the application
export { redisClient };
