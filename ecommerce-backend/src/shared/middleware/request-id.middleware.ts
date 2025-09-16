import { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

/**
 * Request ID middleware configuration
 */
export interface RequestIdConfig {
  headerName: string;
  generateId: () => string;
  setResponseHeader: boolean;
  logRequests: boolean;
}

/**
 * Default configuration for request ID middleware
 */
const DEFAULT_CONFIG: RequestIdConfig = {
  headerName: "x-request-id",
  generateId: () => randomUUID(),
  setResponseHeader: true,
  logRequests: true,
};

/**
 * Request ID middleware factory
 */
export function createRequestIdMiddleware(
  config: Partial<RequestIdConfig> = {},
  logger?: any
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Get existing request ID from headers or generate new one
    let requestId = request.headers[finalConfig.headerName] as string;

    if (!requestId) {
      requestId = finalConfig.generateId();
    }

    // Store request ID in request object
    (request as any).requestId = requestId;
    request.id = requestId;

    // Set response header if configured
    if (finalConfig.setResponseHeader) {
      reply.header(finalConfig.headerName, requestId);
    }

    // Log request if configured and logger is available
    if (finalConfig.logRequests && logger) {
      const startTime = Date.now();

      // Log request start
      logger.info({
        requestId,
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"],
        ip: request.ip,
        timestamp: new Date().toISOString(),
        type: "request_start",
      });

      // Hook into response to log completion
      reply.addHook("onSend", async (request, reply, payload) => {
        const duration = Date.now() - startTime;

        logger.info({
          requestId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration,
          timestamp: new Date().toISOString(),
          type: "request_complete",
        });

        return payload;
      });
    }
  };
}

/**
 * Correlation ID middleware (alias for request ID with different header)
 */
export function createCorrelationIdMiddleware(
  config: Partial<RequestIdConfig> = {},
  logger?: any
) {
  return createRequestIdMiddleware(
    {
      ...config,
      headerName: config.headerName || "x-correlation-id",
    },
    logger
  );
}

/**
 * Get request ID from Fastify request
 */
export function getRequestId(request: FastifyRequest): string | undefined {
  return (request as any).requestId || request.id;
}

/**
 * Get correlation ID from request headers
 */
export function getCorrelationId(request: FastifyRequest): string | undefined {
  return (
    (request.headers["x-correlation-id"] as string) ||
    (request.headers["x-request-id"] as string) ||
    getRequestId(request)
  );
}

/**
 * Enhanced logger that includes request context
 */
export class RequestContextLogger {
  private logger: any;
  private request?: FastifyRequest;

  constructor(logger: any, request?: FastifyRequest) {
    this.logger = logger;
    this.request = request;
  }

  private getContext() {
    if (!this.request) return {};

    return {
      requestId: getRequestId(this.request),
      correlationId: getCorrelationId(this.request),
      method: this.request.method,
      url: this.request.url,
      userAgent: this.request.headers["user-agent"],
      ip: this.request.ip,
      userId: (this.request as any).user?.id,
      vendorId: (this.request as any).user?.vendorId,
    };
  }

  info(message: string | object, meta?: any) {
    const context = this.getContext();

    if (typeof message === "string") {
      this.logger.info(message, { ...context, ...meta });
    } else {
      this.logger.info({ ...message, ...context, ...meta });
    }
  }

  warn(message: string | object, meta?: any) {
    const context = this.getContext();

    if (typeof message === "string") {
      this.logger.warn(message, { ...context, ...meta });
    } else {
      this.logger.warn({ ...message, ...context, ...meta });
    }
  }

  error(message: string | object, meta?: any) {
    const context = this.getContext();

    if (typeof message === "string") {
      this.logger.error(message, { ...context, ...meta });
    } else {
      this.logger.error({ ...message, ...context, ...meta });
    }
  }

  debug(message: string | object, meta?: any) {
    const context = this.getContext();

    if (typeof message === "string") {
      this.logger.debug(message, { ...context, ...meta });
    } else {
      this.logger.debug({ ...message, ...context, ...meta });
    }
  }
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(logger: any, request: FastifyRequest) {
  return new RequestContextLogger(logger, request);
}

/**
 * Structured logging middleware
 */
export function createStructuredLoggingMiddleware(logger: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = getRequestId(request);
    const correlationId = getCorrelationId(request);
    const startTime = process.hrtime.bigint();

    // Add logger to request context
    (request as any).logger = createRequestLogger(logger, request);

    // Log request start
    logger.info({
      message: "Request started",
      requestId,
      correlationId,
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      timestamp: new Date().toISOString(),
      type: "http_request_start",
    });

    // Hook into response to log completion
    reply.addHook("onSend", async (request, reply, payload) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      const logLevel = reply.statusCode >= 400 ? "warn" : "info";

      logger[logLevel]({
        message: "Request completed",
        requestId,
        correlationId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        timestamp: new Date().toISOString(),
        type: "http_request_complete",
      });

      return payload;
    });

    // Hook into error handling
    reply.addHook("onError", async (request, reply, error) => {
      logger.error({
        message: "Request error",
        requestId,
        correlationId,
        method: request.method,
        url: request.url,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date().toISOString(),
        type: "http_request_error",
      });
    });
  };
}

/**
 * Performance monitoring middleware
 */
export function createPerformanceMiddleware(logger?: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = process.hrtime.bigint();
    const requestId = getRequestId(request);

    // Track memory usage
    const startMemory = process.memoryUsage();

    reply.addHook("onSend", async (request, reply, payload) => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      };

      // Log performance metrics
      if (logger) {
        logger.info({
          message: "Performance metrics",
          requestId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: Math.round(duration * 100) / 100,
          memory: {
            delta: memoryDelta,
            current: endMemory,
          },
          timestamp: new Date().toISOString(),
          type: "performance_metrics",
        });
      }

      // Add performance headers
      reply.header("x-response-time", `${Math.round(duration)}ms`);

      return payload;
    });
  };
}

/**
 * Default request ID middleware
 */
export const requestIdMiddleware = createRequestIdMiddleware();

/**
 * Default correlation ID middleware
 */
export const correlationIdMiddleware = createCorrelationIdMiddleware();
