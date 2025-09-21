import fastifyCompress from "@fastify/compress";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config/index.ts";
import { logger } from "../utils/logger.ts";

/**
 * Compression and Security Headers Plugin
 * Implements response compression, security headers, CORS, and request size limits
 */
export async function compressionSecurityPlugin(fastify: FastifyInstance) {
  // ============================================================================
  // COMPRESSION MIDDLEWARE
  // ============================================================================

  await fastify.register(fastifyCompress, {
    global: true,
    threshold: 1024, // Only compress responses larger than 1KB
    encodings: ["gzip", "deflate", "br"], // Support Brotli, gzip, and deflate
    customTypes:
      /^(text\/|application\/(json|javascript|xml|rss\+xml|atom\+xml)|image\/svg\+xml)/, // Compress text-based content
    zlibOptions: {
      level: 6, // Balanced compression level (1-9, 6 is good balance of speed/compression)
      chunkSize: 16 * 1024, // 16KB chunks
    },
    brotliOptions: {
      params: {
        [require("zlib").constants.BROTLI_PARAM_QUALITY]: 6, // Brotli quality level
        [require("zlib").constants.BROTLI_PARAM_SIZE_HINT]: 0,
      },
    },
    onUnsupportedEncoding: (
      encoding: string,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      logger.warn(`Unsupported encoding requested: ${encoding}`, {
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      });
      reply.code(406).send({ error: "Not Acceptable" });
      return '{"error": "Not Acceptable"}';
    },
  });

  // ============================================================================
  // SECURITY HEADERS MIDDLEWARE
  // ============================================================================

  await fastify.register(fastifyHelmet, {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // Allow eval for development
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        mediaSrc: ["'self'", "https:", "blob:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },

    // HTTP Strict Transport Security (HSTS)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // X-Frame-Options
    frameguard: {
      action: "deny",
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: ["strict-origin-when-cross-origin"],
    },

    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disable for API compatibility

    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: {
      policy: "same-origin",
    },

    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    // Hide X-Powered-By header
    hidePoweredBy: true,
  });

  // ============================================================================
  // CORS CONFIGURATION
  // ============================================================================

  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Check against allowed origins
      const allowedOrigins = config.cors.allowedOrigins;

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check for wildcard subdomains
      const isAllowed = allowedOrigins.some((allowedOrigin: string) => {
        if (allowedOrigin.startsWith("*.")) {
          const domain = allowedOrigin.slice(2);
          return origin.endsWith(`.${domain}`) || origin === domain;
        }
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`CORS: Origin not allowed: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-API-Key",
      "X-Tenant-ID",
      "X-Request-ID",
      "Cache-Control",
    ],

    exposedHeaders: [
      "X-Total-Count",
      "X-Page-Count",
      "X-Current-Page",
      "X-Per-Page",
      "X-Request-ID",
      "X-Response-Time",
    ],

    maxAge: 86400, // 24 hours for preflight cache
  });

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  await fastify.register(fastifyRateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,

    // Custom key generator for more sophisticated rate limiting
    keyGenerator: (request: FastifyRequest) => {
      // Use API key if available, otherwise fall back to IP
      const apiKey = request.headers["x-api-key"] as string;
      if (apiKey) {
        return `api:${apiKey}`;
      }

      // Use user ID if authenticated
      const userId = (request as any).user?.id;
      if (userId) {
        return `user:${userId}`;
      }

      // Fall back to IP address
      return `ip:${request.ip}`;
    },

    // Custom error response
    errorResponseBuilder: (_request: FastifyRequest, context: any) => {
      const retryAfter = Math.round(context.ttl / 1000);

      return {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests",
          retryAfter,
          limit: context.max,
          remaining: context.remaining,
          resetTime: new Date(Date.now() + context.ttl),
        },
      };
    },

    // Add rate limit headers
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },

    // Custom hook for rate limit events
    onExceeding: (request: FastifyRequest) => {
      logger.warn("Rate limit approaching", {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        url: request.url,
      });
    },

    onExceeded: (request: FastifyRequest) => {
      logger.warn("Rate limit exceeded", {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        url: request.url,
      });
    },
  });

  // Add skip logic as a separate hook instead of in the rate limit options
  fastify.addHook(
    "preHandler",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      // Skip rate limiting for health checks
      if (request.url === "/health" || request.url === "/metrics") {
        (request as any).skipRateLimit = true;
      }
    }
  );

  // ============================================================================
  // REQUEST SIZE LIMITS
  // ============================================================================

  // Add request size limits
  fastify.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const contentLength = request.headers["content-length"];

      if (contentLength) {
        const size = parseInt(contentLength, 10);
        const maxSize = getMaxRequestSize(request.url);

        if (size > maxSize) {
          logger.warn("Request size limit exceeded", {
            size,
            maxSize,
            url: request.url,
            ip: request.ip,
          });

          return reply.code(413).send({
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "Request entity too large",
              maxSize,
              actualSize: size,
            },
          });
        }
      }
    }
  );

  // ============================================================================
  // ADDITIONAL SECURITY HEADERS
  // ============================================================================

  // Add custom security headers
  fastify.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, payload) => {
      // Server information hiding
      reply.header("Server", "CMS-API");

      // Cache control for API responses
      if (request.url.startsWith("/api/")) {
        reply.header(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private"
        );
        reply.header("Pragma", "no-cache");
        reply.header("Expires", "0");
      }

      // Add request ID for tracing
      const requestId = request.headers["x-request-id"] || generateRequestId();
      reply.header("X-Request-ID", requestId);

      // Add response time header
      const responseTime = Date.now() - (request as any).startTime;
      reply.header("X-Response-Time", `${responseTime}ms`);

      // Content type security
      if (
        reply.getHeader("content-type")?.toString().includes("application/json")
      ) {
        reply.header("X-Content-Type-Options", "nosniff");
      }

      return payload;
    }
  );

  // ============================================================================
  // REQUEST TIMING
  // ============================================================================

  // Add request start time for response time calculation
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    (request as any).startTime = Date.now();
  });

  logger.info("Compression and security middleware registered");
}

/**
 * Get maximum request size based on endpoint
 */
function getMaxRequestSize(url: string): number {
  // Media upload endpoints can handle larger files
  if (url.includes("/media/upload") || url.includes("/upload")) {
    return 100 * 1024 * 1024; // 100MB for file uploads
  }

  // GraphQL endpoints might need larger payloads
  if (url.includes("/graphql")) {
    return 10 * 1024 * 1024; // 10MB for GraphQL
  }

  // Default API request size
  return 1 * 1024 * 1024; // 1MB for regular API requests
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Security headers configuration for different environments
 */
export const getSecurityConfig = () => {
  const baseConfig = {
    // Production security settings
    production: {
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      csp: {
        upgradeInsecureRequests: true,
        reportUri: "/api/csp-report",
      },
      expectCt: {
        maxAge: 86400,
        enforce: true,
      },
    },

    // Development security settings (more relaxed)
    development: {
      hsts: false,
      csp: {
        upgradeInsecureRequests: false,
        reportOnly: true,
      },
      expectCt: false,
    },
  };

  return config.isProduction ? baseConfig.production : baseConfig.development;
};

/**
 * Compression configuration based on content type
 */
export const getCompressionConfig = () => {
  return {
    // Highly compressible content
    text: {
      threshold: 512, // 512 bytes
      level: 9, // Maximum compression
    },

    // Moderately compressible content
    json: {
      threshold: 1024, // 1KB
      level: 6, // Balanced compression
    },

    // Already compressed content (skip)
    media: {
      threshold: Infinity, // Never compress
      level: 0,
    },
  };
};
