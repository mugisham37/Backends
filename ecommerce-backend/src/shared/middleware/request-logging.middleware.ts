/**
 * Request/Response logging middleware
 * Logs API requests and responses with correlation IDs
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../utils/logger";

interface LogEntry {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: string;
}

export interface RequestLoggingConfig {
  logRequests: boolean;
  logResponses: boolean;
  logHeaders: boolean;
  logBody: boolean;
  excludePaths: string[];
  sensitiveFields: string[];
}

const DEFAULT_CONFIG: RequestLoggingConfig = {
  logRequests: true,
  logResponses: true,
  logHeaders: false,
  logBody: false,
  excludePaths: ["/health", "/metrics"],
  sensitiveFields: ["password", "token", "authorization", "cookie"],
};

export const createRequestLoggingMiddleware = (
  config: Partial<RequestLoggingConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const startTime = Date.now();

    // Skip logging for excluded paths
    if (finalConfig.excludePaths.some((path) => request.url.includes(path))) {
      return;
    }

    const requestId = (request as any).id || "unknown";
    const logEntry: LogEntry = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      ip: getClientIp(request),
      userId: (request as any).user?.id,
      timestamp: new Date().toISOString(),
    };

    // Log request
    if (finalConfig.logRequests) {
      const requestLog = {
        ...logEntry,
        type: "REQUEST",
        headers: finalConfig.logHeaders
          ? sanitizeHeaders(request.headers, finalConfig.sensitiveFields)
          : undefined,
        body:
          finalConfig.logBody && request.body
            ? sanitizeObject(request.body, finalConfig.sensitiveFields)
            : undefined,
      };

      logger.info("API Request", requestLog);
    }

    // Track response using server hooks
    const logResponse = () => {
      if (!finalConfig.logResponses) return;

      const duration = Date.now() - startTime;

      const responseLog = {
        ...logEntry,
        type: "RESPONSE",
        duration,
        statusCode: reply.statusCode,
      };

      // Log with appropriate level based on status code
      if (reply.statusCode >= 500) {
        logger.error("API Error Response", responseLog);
      } else if (reply.statusCode >= 400) {
        logger.warn("API Client Error", responseLog);
      } else {
        logger.info("API Response", responseLog);
      }
    };

    // Use onResponse hook for logging
    request.server.addHook("onResponse", async (request, reply) => {
      if (request.url === logEntry.url) {
        logResponse();
      }
    });
  };
};

function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (request.headers["x-real-ip"] as string) ||
    request.ip ||
    "unknown"
  );
}

function sanitizeHeaders(headers: any, sensitiveFields: string[]): any {
  const sanitized = { ...headers };

  sensitiveFields.forEach((field) => {
    const lowerField = field.toLowerCase();
    Object.keys(sanitized).forEach((key) => {
      if (key.toLowerCase().includes(lowerField)) {
        sanitized[key] = "[REDACTED]";
      }
    });
  });

  return sanitized;
}

function sanitizeObject(obj: any, sensitiveFields: string[]): any {
  if (!obj || typeof obj !== "object") return obj;

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  sensitiveFields.forEach((field) => {
    const lowerField = field.toLowerCase();
    Object.keys(sanitized).forEach((key) => {
      if (key.toLowerCase().includes(lowerField)) {
        sanitized[key] = "[REDACTED]";
      }
    });
  });

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key], sensitiveFields);
    }
  });

  return sanitized;
}

// Performance monitoring middleware
export const createPerformanceMiddleware = () => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const startTime = process.hrtime.bigint();

    request.server.addHook("onResponse", async (req, res) => {
      if (req.url === request.url) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        // Set performance header
        res.header("X-Response-Time", `${duration.toFixed(2)}ms`);

        // Log slow requests (> 1 second)
        if (duration > 1000) {
          logger.warn("Slow Request Detected", {
            type: "SLOW_REQUEST",
            requestId: (request as any).id,
            method: request.method,
            url: request.url,
            duration: `${duration.toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  };
};
