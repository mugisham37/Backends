/**
 * Security Plugin for Fastify
 * Comprehensive security setup including rate limiting, headers, and input sanitization
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "../config/env.config.js";
import {
  securityMiddleware,
  securityConfigs,
  getRateLimitMiddleware,
  rateLimitConfigs,
  bruteForceConfigs,
} from "../middleware/index.js";
import { getRedisClient } from "../../modules/cache/redis.client.js";

export interface SecurityPluginOptions {
  // Rate limiting options
  rateLimit?: {
    global?: boolean;
    redis?: boolean;
    skipOnError?: boolean;
  };

  // Security headers options
  helmet?: {
    enabled?: boolean;
    options?: any;
  };

  // CORS options
  cors?: {
    enabled?: boolean;
    origin?: string | string[] | boolean;
    credentials?: boolean;
  };

  // Input sanitization
  sanitization?: {
    enabled?: boolean;
    maxLength?: number;
  };

  // Brute force protection
  bruteForce?: {
    enabled?: boolean;
    endpoints?: string[];
  };

  // IP filtering
  ipFilter?: {
    whitelist?: string[];
    blacklist?: string[];
  };
}

async function securityPlugin(
  fastify: FastifyInstance,
  options: SecurityPluginOptions = {}
) {
  const {
    rateLimit: rateLimitOpts = { global: true, redis: true, skipOnError: true },
    helmet: helmetOpts = { enabled: true },
    cors: corsOpts = { enabled: true, credentials: false },
    sanitization: sanitizationOpts = { enabled: true, maxLength: 10000 },
    bruteForce: bruteForceOpts = {
      enabled: true,
      endpoints: ["/auth/login", "/auth/admin-login"],
    },
    ipFilter: ipFilterOpts = {},
  } = options;

  // Register Helmet for security headers
  if (helmetOpts.enabled) {
    await fastify.register(helmet, {
      contentSecurityPolicy:
        config.nodeEnv === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
              },
            }
          : false,
      hsts:
        config.nodeEnv === "production"
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
      ...helmetOpts.options,
    });
  }

  // Register CORS
  if (corsOpts.enabled) {
    await fastify.register(cors, {
      origin:
        corsOpts.origin ?? (config.nodeEnv === "development" ? true : false),
      credentials: corsOpts.credentials ?? false,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Request-ID",
        "X-API-Version",
      ],
      exposedHeaders: [
        "X-Request-ID",
        "X-RateLimit-Remaining",
        "X-RateLimit-Limit",
        "X-RateLimit-Reset",
      ],
    });
  }

  // Register global rate limiting
  if (rateLimitOpts.global) {
    const rateLimitConfig: any = {
      max: rateLimitConfigs.api.max,
      timeWindow: rateLimitConfigs.api.window,
      skipOnError: rateLimitOpts.skipOnError ?? true,
      keyGenerator: (request: any) => {
        const ip =
          request.ip || request.headers["x-forwarded-for"] || "unknown";
        const userId = request.userId;
        return userId ? `user:${userId}` : `ip:${ip}`;
      },
      errorResponseBuilder: (request: any, context: any) => ({
        success: false,
        error: {
          message: "Too many requests, please try again later",
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            limit: context.max,
            window: context.timeWindow,
            retryAfter: context.ttl,
          },
        },
      }),
    };

    // Use Redis for rate limiting if enabled
    if (rateLimitOpts.redis) {
      try {
        const redis = getRedisClient();
        rateLimitConfig.redis = redis;
        rateLimitConfig.nameSpace = "rate_limit:";
      } catch (error) {
        fastify.log.warn(
          "Redis not available for rate limiting, using in-memory store"
        );
      }
    }

    await fastify.register(rateLimit, rateLimitConfig);
  }

  // Add custom security middleware hooks
  fastify.addHook("onRequest", async (request, reply) => {
    // IP filtering
    if (ipFilterOpts.whitelist || ipFilterOpts.blacklist) {
      await securityMiddleware.ipFilter(ipFilterOpts)(request, reply);
    }

    // Input sanitization
    if (sanitizationOpts.enabled) {
      await securityMiddleware.sanitizeInput({
        maxLength: sanitizationOpts.maxLength,
      })(request, reply);
    }
  });

  // Register endpoint-specific rate limiting
  fastify.addHook("onRoute", (routeOptions) => {
    const { url, method } = routeOptions;

    // Authentication endpoints - stricter rate limiting
    if (url.includes("/auth/")) {
      routeOptions.preHandler = routeOptions.preHandler || [];
      if (!Array.isArray(routeOptions.preHandler)) {
        routeOptions.preHandler = [routeOptions.preHandler];
      }

      routeOptions.preHandler.push(
        getRateLimitMiddleware().createRateLimit(rateLimitConfigs.auth)
      );

      // Add brute force protection for login endpoints
      if (
        bruteForceOpts.enabled &&
        (url.includes("/login") || url.includes("/admin-login"))
      ) {
        const config = url.includes("/admin")
          ? bruteForceConfigs.adminLogin
          : bruteForceConfigs.login;
        routeOptions.preHandler.push(
          getRateLimitMiddleware().createBruteForceProtection(config)
        );
      }
    }

    // Password reset endpoints
    if (url.includes("/password-reset") || url.includes("/forgot-password")) {
      routeOptions.preHandler = routeOptions.preHandler || [];
      if (!Array.isArray(routeOptions.preHandler)) {
        routeOptions.preHandler = [routeOptions.preHandler];
      }

      routeOptions.preHandler.push(
        getRateLimitMiddleware().createRateLimit(rateLimitConfigs.passwordReset)
      );

      if (bruteForceOpts.enabled) {
        routeOptions.preHandler.push(
          getRateLimitMiddleware().createBruteForceProtection(
            bruteForceConfigs.passwordReset
          )
        );
      }
    }

    // File upload endpoints
    if (
      url.includes("/upload") ||
      (method === "POST" && url.includes("/media"))
    ) {
      routeOptions.preHandler = routeOptions.preHandler || [];
      if (!Array.isArray(routeOptions.preHandler)) {
        routeOptions.preHandler = [routeOptions.preHandler];
      }

      routeOptions.preHandler.push(
        getRateLimitMiddleware().createRateLimit(rateLimitConfigs.upload)
      );
    }

    // Search endpoints
    if (url.includes("/search")) {
      routeOptions.preHandler = routeOptions.preHandler || [];
      if (!Array.isArray(routeOptions.preHandler)) {
        routeOptions.preHandler = [routeOptions.preHandler];
      }

      routeOptions.preHandler.push(
        getRateLimitMiddleware().createRateLimit(rateLimitConfigs.search)
      );
    }

    // Admin endpoints - higher limits but still protected
    if (url.includes("/admin/")) {
      routeOptions.preHandler = routeOptions.preHandler || [];
      if (!Array.isArray(routeOptions.preHandler)) {
        routeOptions.preHandler = [routeOptions.preHandler];
      }

      routeOptions.preHandler.push(
        getRateLimitMiddleware().createRateLimit(rateLimitConfigs.admin)
      );
    }
  });

  // Add security response headers
  fastify.addHook("onSend", async (request, reply, payload) => {
    // Add security headers that aren't handled by helmet
    reply.header("X-Request-ID", (request as any).id || "unknown");

    // Remove server information
    reply.removeHeader("Server");

    // Add API-specific security headers
    if (request.url.startsWith("/api/")) {
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    return payload;
  });

  // Add error handling for security-related errors
  fastify.setErrorHandler(async (error, request, reply) => {
    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          message: "Too many requests, please try again later",
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            retryAfter: error.retryAfter || 60,
          },
        },
      });
    }

    // Security-related errors
    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.status(415).send({
        success: false,
        error: {
          message: "Unsupported media type",
          code: "UNSUPPORTED_MEDIA_TYPE",
        },
      });
    }

    if (error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
      return reply.status(400).send({
        success: false,
        error: {
          message: "Empty JSON body",
          code: "EMPTY_BODY",
        },
      });
    }

    // Re-throw other errors to be handled by global error handler
    throw error;
  });

  // Register utility routes for security management
  fastify.register(async function securityRoutes(fastify) {
    // Health check endpoint (no rate limiting)
    fastify.get(
      "/health",
      {
        schema: {
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      async (request, reply) => {
        return {
          status: "ok",
          timestamp: new Date().toISOString(),
        };
      }
    );

    // Security info endpoint (admin only)
    fastify.get(
      "/security/info",
      {
        preHandler: [
          // Would need auth middleware here
          // authMiddleware.authenticate,
          // authMiddleware.requireAdmin,
        ],
      },
      async (request, reply) => {
        return {
          rateLimit: {
            enabled: rateLimitOpts.global,
            redis: rateLimitOpts.redis,
          },
          bruteForce: {
            enabled: bruteForceOpts.enabled,
            protectedEndpoints: bruteForceOpts.endpoints,
          },
          security: {
            helmet: helmetOpts.enabled,
            cors: corsOpts.enabled,
            sanitization: sanitizationOpts.enabled,
          },
        };
      }
    );
  });

  fastify.log.info("Security plugin registered successfully");
}

export default fp(securityPlugin, {
  name: "security",
  dependencies: [],
});
