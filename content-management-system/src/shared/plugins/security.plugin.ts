/**
 * Security Plugin
 * Comprehensive security implementation for Fastify with CORS, Helmet, Rate Limiting
 */

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { config } from "../config/env.config";
import {
  type SecurityConfig,
  logSecurityEvent,
} from "../config/security.config";
import { logger } from "../utils/logger";

/**
 * Security plugin options interface
 */
export type SecurityPluginOptions = SecurityConfig;

/**
 * Security plugin implementation
 */
async function securityPlugin(
  fastify: FastifyInstance,
  options: SecurityPluginOptions
) {
  const securityLogger = logger.child({ module: "security" });

  securityLogger.info("🛡️ Initializing security plugin...");

  // Register Helmet for security headers
  if (options.headers.helmet) {
    await fastify.register(helmet, {
      global: true,
      contentSecurityPolicy: options.headers.csp
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "https:"],
              fontSrc: ["'self'"],
              connectSrc: ["'self'"],
              mediaSrc: ["'self'"],
              objectSrc: ["'none'"],
              childSrc: ["'self'"],
              frameSrc: ["'none'"],
              workerSrc: ["'self'"],
              frameAncestors: ["'none'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      hsts: options.headers.hsts
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      noSniff: options.headers.noSniff,
      frameguard: {
        action: options.headers.frameOptions === "DENY" ? "deny" : "sameorigin",
      },
      xssFilter: true,
      referrerPolicy: { policy: "same-origin" },
    });

    securityLogger.info("✅ Helmet security headers configured");
  }

  // Register CORS
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    allowedHeaders: config.cors.allowedHeaders,
    methods: config.cors.methods,
    optionsSuccessStatus: 200,
  } as any);

  securityLogger.info("✅ CORS configured");

  // Register Rate Limiting
  if (options.rateLimiting.enabled) {
    await fastify.register(rateLimit, {
      max: options.rateLimiting.maxRequests,
      timeWindow: options.rateLimiting.windowMs,
      addHeaders: {
        "x-ratelimit-limit": true,
        "x-ratelimit-remaining": true,
        "x-ratelimit-reset": true,
      },
      keyGenerator:
        options.rateLimiting.keyGenerator ||
        ((request: FastifyRequest) => {
          return (
            (request.headers["x-forwarded-for"] as string) ||
            (request.headers["x-real-ip"] as string) ||
            request.ip
          );
        }),
      errorResponseBuilder: (_request: FastifyRequest, context: any) => {
        return {
          error: "Rate Limit Exceeded",
          message: `Too many requests, please try again later. Limit: ${
            context.max
          } requests per ${Math.round(context.ttl / 1000)} seconds.`,
          statusCode: 429,
          retryAfter: Math.round(context.ttl / 1000),
        };
      },
      onExceeding: (request: FastifyRequest) => {
        logSecurityEvent({
          type: "violation",
          severity: "medium",
          request,
          details: {
            reason: "Rate limit exceeded",
            ip: request.ip,
            userAgent: request.headers["user-agent"],
          },
        });
      },
    });

    securityLogger.info("✅ Rate limiting configured");
  }

  // Security hooks
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Add security headers manually if needed
      reply.header("X-Request-ID", request.id);
      reply.header("X-Powered-By", "CMS-API");

      // Validate security headers if enabled
      if (options.monitoring.securityEvents) {
        const hasValidHeaders = validateSecurityHeaders(request);
        if (!hasValidHeaders && config.isProduction) {
          logSecurityEvent({
            type: "suspicious",
            severity: "low",
            request,
            details: {
              reason: "Missing or invalid security headers",
              headers: request.headers,
            },
          });
        }
      }

      // Check for suspicious patterns
      if (options.monitoring.suspiciousActivity) {
        const suspiciousPatterns = [
          /\.\./, // Path traversal
          /<script/i, // XSS attempts
          /union.*select/i, // SQL injection
          /javascript:/i, // JavaScript injection
        ];

        const url = request.url;
        const userAgent = request.headers["user-agent"] || "";

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(url) || pattern.test(userAgent)) {
            logSecurityEvent({
              type: "suspicious",
              severity: "high",
              request,
              details: {
                reason: "Suspicious pattern detected",
                pattern: pattern.toString(),
                url,
                userAgent,
              },
            });
            break;
          }
        }
      }
    }
  );

  // Authentication hook
  if (options.authentication.enabled) {
    fastify.addHook(
      "preHandler",
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip authentication for health checks and public endpoints
        const publicPaths = ["/health", "/ready", "/version", "/api/docs"];
        const isPublicPath = publicPaths.some((path) =>
          request.url.startsWith(path)
        );

        if (isPublicPath) {
          return;
        }

        try {
          // JWT verification
          if (options.authentication.jwtVerification) {
            const token = extractToken(request);

            if (!token && options.authentication.requireApiKey) {
              return reply.status(401).send({
                error: "Unauthorized",
                message: "Authentication token required",
                statusCode: 401,
              });
            }

            if (token) {
              try {
                const decoded = await request.jwtVerify();
                request.user = decoded;
              } catch (error) {
                logSecurityEvent({
                  type: "authentication",
                  severity: "medium",
                  request,
                  details: {
                    reason: "Invalid JWT token",
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                });

                return reply.status(401).send({
                  error: "Unauthorized",
                  message: "Invalid authentication token",
                  statusCode: 401,
                });
              }
            }
          }

          // API Key verification
          if (options.authentication.requireApiKey && !request.user) {
            const apiKey = request.headers["x-api-key"] as string;

            if (!apiKey) {
              return reply.status(401).send({
                error: "Unauthorized",
                message: "API key required",
                statusCode: 401,
              });
            }

            // API key validation would go here
            // For now, we'll just check if it exists
          }
        } catch (error) {
          logSecurityEvent({
            type: "authentication",
            severity: "high",
            request,
            details: {
              reason: "Authentication error",
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });

          return reply.status(500).send({
            error: "Internal Server Error",
            message: "Authentication service error",
            statusCode: 500,
          });
        }
      }
    );

    securityLogger.info("✅ Authentication hooks configured");
  }

  // Input validation hook
  if (options.validation.strictMode) {
    fastify.addHook(
      "preValidation",
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Check payload size
        if (request.headers["content-length"]) {
          const contentLength = parseInt(request.headers["content-length"], 10);

          if (contentLength > options.validation.maxPayloadSize) {
            logSecurityEvent({
              type: "violation",
              severity: "medium",
              request,
              details: {
                reason: "Payload too large",
                contentLength,
                maxAllowed: options.validation.maxPayloadSize,
              },
            });

            return reply.status(413).send({
              error: "Payload Too Large",
              message: `Request payload exceeds maximum size of ${options.validation.maxPayloadSize} bytes`,
              statusCode: 413,
            });
          }
        }

        // Sanitize input if enabled
        if (options.validation.sanitizeInput && request.body) {
          request.body = sanitizeObject(request.body);
        }
      }
    );

    securityLogger.info("✅ Input validation hooks configured");
  }

  securityLogger.info("🎉 Security plugin initialized successfully");
}

/**
 * Extract authentication token from request
 */
function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Validate security headers
 */
function validateSecurityHeaders(request: FastifyRequest): boolean {
  const requiredHeaders = ["user-agent"];

  for (const header of requiredHeaders) {
    if (!request.headers[header]) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return typeof obj === "string" ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[sanitizeString(key)] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitize string input
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

export default fastifyPlugin(securityPlugin, {
  name: "security-plugin",
  fastify: "4.x",
});
