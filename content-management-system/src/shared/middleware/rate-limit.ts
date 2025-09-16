import rateLimit from "express-rate-limit";
import Redis from "ioredis";
import RedisStore from "rate-limit-redis";
import { config } from "../config";
import { logger } from "../utils/logger";

// Create Redis client for rate limiting if Redis is enabled
let redisClient: Redis | null = null;

if (config.redis.enabled) {
  try {
    const options: any = {};
    if (config.redis.password) {
      options.password = config.redis.password;
    }

    redisClient = new Redis(config.redis.uri, options);

    redisClient.on("error", (error) => {
      logger.error("Redis rate limit error:", error);
      redisClient = null;
    });
  } catch (error) {
    logger.error("Failed to initialize Redis for rate limiting:", error);
    redisClient = null;
  }
}

// Create rate limiter
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
  // Use Redis store if available
  ...(redisClient
    ? {
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient?.call(...args),
        }),
      }
    : {}),
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
  // Use Redis store if available
  ...(redisClient
    ? {
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient?.call(...args),
        }),
      }
    : {}),
});
