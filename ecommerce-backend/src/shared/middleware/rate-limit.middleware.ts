/**
 * Rate Limiting Middleware
 * Redis-based rate limiting with per-endpoint configuration and brute force protection
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import { getRedisClient } from "../../modules/cache/redis.client.js";
import { config } from "../config/env.config.js";
import { logger } from "../utils/logger.js";

export interface RateLimitOptions {
  max: number; // Maximum requests
  window: number; // Time window in milliseconds
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  headers?: boolean;
}

export interface BruteForceOptions {
  freeRetries: number; // Number of retries before blocking
  minWait: number; // Minimum wait time in milliseconds
  maxWait: number; // Maximum wait time in milliseconds
  lifetime: number; // How long to keep the counter
  failCallback?: (request: FastifyRequest, reply: FastifyReply) => void;
}

export class RateLimitMiddleware {
  private redis: any;

  constructor(redisClient?: any) {
    this.redis = redisClient || getRedisClient();
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimit = (options: RateLimitOptions) => {
    const {
      max = config.rateLimit.max,
      window = config.rateLimit.window,
      keyGenerator = this.defaultKeyGenerator,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      message = "Too many requests, please try again later",
      headers = true,
    } = options;

    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const key = keyGenerator(request);
      const windowStart = Math.floor(Date.now() / window) * window;
      const redisKey = `rate_limit:${key}:${windowStart}`;

      try {
        // Get current count
        const current = await this.redis.get(redisKey);
        const count = current ? parseInt(current, 10) : 0;

        // Check if limit exceeded
        if (count >= max) {
          if (headers) {
            reply.headers({
              "X-RateLimit-Limit": max.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": (windowStart + window).toString(),
            });
          }
          throw new AppError(message, 429, "RATE_LIMIT_EXCEEDED", {
            limit: max,
            window: window,
            retryAfter: windowStart + window - Date.now(),
          });
        }

        // Increment counter
        const pipeline = this.redis.pipeline();
        pipeline.incr(redisKey);
        pipeline.expire(redisKey, Math.ceil(window / 1000));
        await pipeline.exec();

        // Add headers
        if (headers) {
          reply.headers({
            "X-RateLimit-Limit": max.toString(),
            "X-RateLimit-Remaining": (max - count - 1).toString(),
            "X-RateLimit-Reset": (windowStart + window).toString(),
          });
        }

        // Hook into response to handle skip options
        if (skipSuccessfulRequests || skipFailedRequests) {
          request.server.addHook(
            "onSend",
            async (request: FastifyRequest, reply: FastifyReply) => {
              const statusCode = reply.statusCode;
              const shouldSkip =
                (skipSuccessfulRequests && statusCode < 400) ||
                (skipFailedRequests && statusCode >= 400);

              if (shouldSkip) {
                await this.redis.decr(redisKey);
              }
            }
          );
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        // If Redis fails, allow the request but log the error
        console.error("Brute force protection error:", error);
      }
    };
  };

  /**
   * Brute force protection middleware
   */
  createBruteForceProtection = (options: BruteForceOptions) => {
    const { freeRetries, minWait, maxWait, lifetime, failCallback } = options;

    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const key = this.getBruteForceKey(request);
      const attemptsKey = `brute_force:attempts:${key}`;
      const blockKey = `brute_force:block:${key}`;

      try {
        // Check if currently blocked
        const blockTime = await this.redis.get(blockKey);
        if (blockTime) {
          const remainingTime = parseInt(blockTime, 10) - Date.now();
          if (remainingTime > 0) {
            throw new AppError(
              "Too many failed attempts. Please try again later.",
              429,
              "BRUTE_FORCE_BLOCKED",
              { retryAfter: remainingTime }
            );
          } else {
            // Block expired, clean up
            await this.redis.del(blockKey);
          }
        }

        // Hook into response to track failures
        request.server.addHook(
          "onSend",
          async (request: FastifyRequest, reply: FastifyReply) => {
            const statusCode = reply.statusCode;

            if (statusCode === 401 || statusCode === 403) {
              // Failed authentication/authorization
              const attempts = await this.redis.incr(attemptsKey);
              await this.redis.expire(attemptsKey, Math.ceil(lifetime / 1000));

              if (attempts > freeRetries) {
                // Calculate block time with exponential backoff
                const blockDuration = Math.min(
                  minWait * Math.pow(2, attempts - freeRetries - 1),
                  maxWait
                );
                const blockUntil = Date.now() + blockDuration;

                await this.redis.setex(
                  blockKey,
                  Math.ceil(blockDuration / 1000),
                  blockUntil.toString()
                );

                if (failCallback) {
                  failCallback(request, reply);
                }
              }
            } else if (statusCode < 400) {
              // Successful request, reset attempts
              await this.redis.del(attemptsKey);
            }
          }
        );
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        logger.error("Brute force protection error:", error);
      }
    };
  };

  /**
   * Default key generator for rate limiting
   */
  private defaultKeyGenerator = (request: FastifyRequest): string => {
    const ip = this.getClientIP(request);
    const userId = (request as any).userId;
    return userId ? `user:${userId}` : `ip:${ip}`;
  };

  /**
   * Get brute force protection key
   */
  private getBruteForceKey = (request: FastifyRequest): string => {
    const ip = this.getClientIP(request);
    const userAgent = request.headers["user-agent"] || "unknown";
    return `${ip}:${Buffer.from(userAgent).toString("base64").slice(0, 10)}`;
  };

  /**
   * Extract client IP address
   */
  private getClientIP = (request: FastifyRequest): string => {
    return (
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (request.headers["x-real-ip"] as string) ||
      request.ip ||
      "unknown"
    );
  };

  /**
   * Clear rate limit for a specific key
   */
  async clearRateLimit(key: string): Promise<void> {
    const pattern = `rate_limit:${key}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Clear brute force protection for a specific key
   */
  async clearBruteForce(key: string): Promise<void> {
    await Promise.all([
      this.redis.del(`brute_force:attempts:${key}`),
      this.redis.del(`brute_force:block:${key}`),
    ]);
  }

  /**
   * Get rate limit status for a key
   */
  async getRateLimitStatus(
    key: string,
    window: number
  ): Promise<{
    count: number;
    remaining: number;
    resetTime: number;
  }> {
    const windowStart = Math.floor(Date.now() / window) * window;
    const redisKey = `rate_limit:${key}:${windowStart}`;
    const current = await this.redis.get(redisKey);
    const count = current ? parseInt(current, 10) : 0;
    const max = config.rateLimit.max;

    return {
      count,
      remaining: Math.max(0, max - count),
      resetTime: windowStart + window,
    };
  }
}

// Factory function to create rate limit middleware
export const createRateLimitMiddleware = (
  redisClient?: any
): RateLimitMiddleware => {
  return new RateLimitMiddleware(redisClient);
};

// Lazy singleton instance
let _rateLimitMiddleware: RateLimitMiddleware | null = null;
export const getRateLimitMiddleware = (): RateLimitMiddleware => {
  if (!_rateLimitMiddleware) {
    _rateLimitMiddleware = createRateLimitMiddleware();
  }
  return _rateLimitMiddleware;
};

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // General API rate limit
  api: {
    max: 100,
    window: 15 * 60 * 1000, // 15 minutes
  },

  // Authentication endpoints
  auth: {
    max: 5,
    window: 15 * 60 * 1000, // 15 minutes
    message: "Too many authentication attempts",
  },

  // Password reset
  passwordReset: {
    max: 3,
    window: 60 * 60 * 1000, // 1 hour
    message: "Too many password reset attempts",
  },

  // File upload
  upload: {
    max: 10,
    window: 60 * 1000, // 1 minute
    message: "Too many file upload attempts",
  },

  // Search endpoints
  search: {
    max: 50,
    window: 60 * 1000, // 1 minute
  },

  // Admin endpoints
  admin: {
    max: 200,
    window: 15 * 60 * 1000, // 15 minutes
  },
};

// Brute force protection configurations
export const bruteForceConfigs = {
  // Login protection
  login: {
    freeRetries: 3,
    minWait: 5 * 60 * 1000, // 5 minutes
    maxWait: 60 * 60 * 1000, // 1 hour
    lifetime: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Password reset protection
  passwordReset: {
    freeRetries: 2,
    minWait: 15 * 60 * 1000, // 15 minutes
    maxWait: 2 * 60 * 60 * 1000, // 2 hours
    lifetime: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Admin login protection
  adminLogin: {
    freeRetries: 2,
    minWait: 10 * 60 * 1000, // 10 minutes
    maxWait: 2 * 60 * 60 * 1000, // 2 hours
    lifetime: 24 * 60 * 60 * 1000, // 24 hours
  },
};
