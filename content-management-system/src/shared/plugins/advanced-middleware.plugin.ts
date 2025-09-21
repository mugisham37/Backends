/**
 * Advanced Middleware Plugin
 * Comprehensive middleware setup with monitoring, compression, and performance optimization
 */

import compress from "@fastify/compress";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { config } from "../config/env.config";
import { logger } from "../utils/logger";

/**
 * Middleware configuration interface
 */
export interface MiddlewareConfig {
  // Compression settings
  compression: {
    enabled: boolean;
    threshold: number;
    algorithms: string[];
  };

  // Request/Response logging
  logging: {
    enabled: boolean;
    includeHeaders: boolean;
    includeBody: boolean;
    sensitiveHeaders: string[];
  };

  // Performance monitoring
  performance: {
    enabled: boolean;
    slowRequestThreshold: number;
    memoryMonitoring: boolean;
  };

  // Request tracking
  tracking: {
    enabled: boolean;
    correlationIdHeader: string;
    userAgentLogging: boolean;
  };

  // Health monitoring
  health: {
    enabled: boolean;
    endpoint: string;
    includeDetails: boolean;
  };
}

/**
 * Middleware presets for different environments
 */
export const middlewarePresets = {
  development: {
    compression: {
      enabled: true,
      threshold: 1024,
      algorithms: ["gzip", "deflate"],
    },
    logging: {
      enabled: true,
      includeHeaders: true,
      includeBody: false,
      sensitiveHeaders: ["authorization", "cookie", "x-api-key"],
    },
    performance: {
      enabled: true,
      slowRequestThreshold: 1000, // 1 second
      memoryMonitoring: true,
    },
    tracking: {
      enabled: true,
      correlationIdHeader: "x-correlation-id",
      userAgentLogging: true,
    },
    health: {
      enabled: true,
      endpoint: "/health",
      includeDetails: true,
    },
  } as MiddlewareConfig,

  staging: {
    compression: {
      enabled: true,
      threshold: 512,
      algorithms: ["gzip", "deflate", "br"],
    },
    logging: {
      enabled: true,
      includeHeaders: false,
      includeBody: false,
      sensitiveHeaders: [
        "authorization",
        "cookie",
        "x-api-key",
        "x-forwarded-for",
      ],
    },
    performance: {
      enabled: true,
      slowRequestThreshold: 500, // 500ms
      memoryMonitoring: true,
    },
    tracking: {
      enabled: true,
      correlationIdHeader: "x-correlation-id",
      userAgentLogging: false,
    },
    health: {
      enabled: true,
      endpoint: "/health",
      includeDetails: true,
    },
  } as MiddlewareConfig,

  production: {
    compression: {
      enabled: true,
      threshold: 256,
      algorithms: ["br", "gzip"],
    },
    logging: {
      enabled: true,
      includeHeaders: false,
      includeBody: false,
      sensitiveHeaders: [
        "authorization",
        "cookie",
        "x-api-key",
        "x-forwarded-for",
        "x-real-ip",
      ],
    },
    performance: {
      enabled: true,
      slowRequestThreshold: 200, // 200ms
      memoryMonitoring: false, // Disabled in production for performance
    },
    tracking: {
      enabled: true,
      correlationIdHeader: "x-correlation-id",
      userAgentLogging: false,
    },
    health: {
      enabled: true,
      endpoint: "/health",
      includeDetails: false,
    },
  } as MiddlewareConfig,
} as const;

/**
 * Advanced middleware plugin options
 */
export type AdvancedMiddlewareOptions = MiddlewareConfig;

/**
 * Advanced middleware plugin implementation
 */
async function advancedMiddlewarePlugin(
  fastify: FastifyInstance,
  options: AdvancedMiddlewareOptions
) {
  const middlewareLogger = logger.child({ module: "middleware" });

  middlewareLogger.info("🔧 Initializing advanced middleware...");

  // Compression middleware
  if (options.compression.enabled) {
    await fastify.register(compress, {
      global: true,
      threshold: options.compression.threshold,
      encodings: ["gzip", "deflate", "br"] as any,
      brotliOptions: {},
      zlibOptions: {
        level: 6,
        windowBits: 15,
        memLevel: 8,
      },
    });

    middlewareLogger.info("✅ Compression middleware configured");
  }

  // Request tracking and correlation ID
  if (options.tracking.enabled) {
    fastify.addHook(
      "onRequest",
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Generate or extract correlation ID
        const correlationId =
          (request.headers[options.tracking.correlationIdHeader] as string) ||
          (request.headers["x-request-id"] as string) ||
          generateCorrelationId();

        request.headers[options.tracking.correlationIdHeader] = correlationId;
        reply.header("X-Correlation-ID", correlationId);

        // Track request start time
        (request as any).startTime = Date.now();

        // Add correlation ID to logs
        request.log = request.log.child({ correlationId });
      }
    );

    middlewareLogger.info("✅ Request tracking configured");
  }

  // Performance monitoring
  if (options.performance.enabled) {
    fastify.addHook(
      "onResponse",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const responseTime =
          Date.now() - ((request as any).startTime || Date.now());

        // Log slow requests
        if (responseTime > options.performance.slowRequestThreshold) {
          request.log.warn(
            {
              responseTime,
              method: request.method,
              url: request.url,
              statusCode: reply.statusCode,
            },
            `Slow request detected: ${responseTime}ms`
          );
        }

        // Memory monitoring
        if (options.performance.memoryMonitoring) {
          const memoryUsage = process.memoryUsage();

          if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
            // 100MB threshold
            request.log.warn(
              {
                memoryUsage: {
                  heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                  heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                  rss: Math.round(memoryUsage.rss / 1024 / 1024),
                },
              },
              "High memory usage detected"
            );
          }
        }

        // Add performance headers
        reply.header("X-Response-Time", `${responseTime}ms`);
      }
    );

    middlewareLogger.info("✅ Performance monitoring configured");
  }

  // Enhanced request/response logging
  if (options.logging.enabled) {
    fastify.addHook("onRequest", async (request: FastifyRequest) => {
      const logData: any = {
        method: request.method,
        url: request.url,
        ip: getClientIp(request),
      };

      if (options.logging.includeHeaders) {
        logData.headers = sanitizeHeaders(
          request.headers,
          options.logging.sensitiveHeaders
        );
      }

      if (options.tracking.userAgentLogging) {
        logData.userAgent = request.headers["user-agent"];
      }

      request.log.info(logData, "Incoming request");
    });

    fastify.addHook(
      "onResponse",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const responseTime =
          Date.now() - ((request as any).startTime || Date.now());

        const logData: any = {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: `${responseTime}ms`,
        };

        const logLevel =
          reply.statusCode >= 500
            ? "error"
            : reply.statusCode >= 400
              ? "warn"
              : "info";

        request.log[logLevel](logData, "Request completed");
      }
    );

    middlewareLogger.info("✅ Enhanced logging configured");
  }

  // Error handling middleware
  fastify.addHook(
    "onError",
    async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const errorData = {
        error: error.message,
        stack: config.isDevelopment ? error.stack : undefined,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        correlationId: request.headers[options.tracking.correlationIdHeader],
      };

      request.log.error(errorData, "Request error occurred");

      // Add error tracking headers
      reply.header("X-Error-ID", request.id);
    }
  );

  // Health check enhancement
  if (options.health.enabled) {
    fastify.get(options.health.endpoint, async (_request, reply) => {
      const healthData: any = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        uptime: process.uptime(),
      };

      if (options.health.includeDetails) {
        const memoryUsage = process.memoryUsage();

        healthData.details = {
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
          },
          load: [0, 0, 0], // Simplified for Windows compatibility
          nodeVersion: process.version,
        };
      }

      return reply.status(200).send(healthData);
    });

    middlewareLogger.info("✅ Enhanced health check configured");
  }

  // Request size monitoring
  fastify.addHook(
    "preValidation",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const contentLength = request.headers["content-length"];

      if (contentLength) {
        const size = parseInt(contentLength, 10);
        const maxSize = config.upload.maxFileSize;

        if (size > maxSize) {
          request.log.warn(
            {
              contentLength: size,
              maxAllowed: maxSize,
              url: request.url,
            },
            "Large request payload detected"
          );
        }
      }
    }
  );

  // Response size monitoring
  fastify.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      if (payload && typeof payload === "string") {
        const size = Buffer.byteLength(payload);

        if (size > 1024 * 1024) {
          // 1MB threshold
          request.log.warn(
            {
              responseSize: size,
              url: request.url,
            },
            "Large response payload detected"
          );
        }

        reply.header("Content-Length", size.toString());
      }

      return payload;
    }
  );

  middlewareLogger.info("🎉 Advanced middleware initialized successfully");
}

/**
 * Generate correlation ID
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get client IP address
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"] as string;
  const realIp = request.headers["x-real-ip"] as string;

  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0] || "unknown";
  }

  if (realIp) {
    return realIp;
  }

  return request.ip;
}

/**
 * Sanitize headers by removing sensitive information
 */
function sanitizeHeaders(
  headers: Record<string, any>,
  sensitiveHeaders: string[]
): Record<string, any> {
  const sanitized = { ...headers };

  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Middleware metrics (for future integration with monitoring systems)
 */
export const middlewareMetrics = {
  requestCount: 0,
  errorCount: 0,
  averageResponseTime: 0,

  incrementRequest() {
    this.requestCount++;
  },

  incrementError() {
    this.errorCount++;
  },

  updateAverageResponseTime(responseTime: number) {
    this.averageResponseTime = (this.averageResponseTime + responseTime) / 2;
  },

  getMetrics() {
    return {
      requests: this.requestCount,
      errors: this.errorCount,
      averageResponseTime: this.averageResponseTime,
      errorRate:
        this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
    };
  },
};

export default fastifyPlugin(advancedMiddlewarePlugin, {
  name: "advanced-middleware-plugin",
  fastify: "4.x",
});
