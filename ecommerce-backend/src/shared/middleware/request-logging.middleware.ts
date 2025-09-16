/**
 * Request/Response logging middleware
 * Logs API requests and responses with correlation IDs
 */

import { Request, Response, NextFunction } from "express";

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

export const requestLoggingMiddleware = (
  config: Partial<RequestLoggingConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Skip logging for excluded paths
    if (finalConfig.excludePaths.some((path) => req.path.includes(path))) {
      return next();
    }

    const logEntry: LogEntry = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
      ip: getClientIp(req),
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString(),
    };

    // Log request
    if (finalConfig.logRequests) {
      const requestLog = {
        ...logEntry,
        type: "REQUEST",
        ...(finalConfig.logHeaders && {
          headers: sanitizeHeaders(req.headers, finalConfig.sensitiveFields),
        }),
        ...(finalConfig.logBody &&
          req.body && {
            body: sanitizeObject(req.body, finalConfig.sensitiveFields),
          }),
      };

      console.log(JSON.stringify(requestLog));
    }

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to capture response data
    res.send = function (body: any) {
      logResponse(body);
      return originalSend.call(this, body);
    };

    res.json = function (body: any) {
      logResponse(body);
      return originalJson.call(this, body);
    };

    function logResponse(body: any) {
      if (!finalConfig.logResponses) return;

      const duration = Date.now() - startTime;
      const responseSize = Buffer.byteLength(
        JSON.stringify(body || ""),
        "utf8"
      );

      const responseLog = {
        ...logEntry,
        type: "RESPONSE",
        duration,
        statusCode: res.statusCode,
        responseSize,
        ...(res.statusCode >= 400 && {
          error: body?.error?.message || "Unknown error",
        }),
        ...(finalConfig.logBody &&
          body && { body: sanitizeObject(body, finalConfig.sensitiveFields) }),
      };

      // Log with appropriate level based on status code
      if (res.statusCode >= 500) {
        console.error(JSON.stringify(responseLog));
      } else if (res.statusCode >= 400) {
        console.warn(JSON.stringify(responseLog));
      } else {
        console.log(JSON.stringify(responseLog));
      }
    }

    next();
  };
};

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string) ||
    (req.headers["x-real-ip"] as string) ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
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
export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime.bigint();

  // Override the end method to capture timing before response is sent
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Set performance header before ending response
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${duration.toFixed(2)}ms`);
    }

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(
        JSON.stringify({
          type: "SLOW_REQUEST",
          requestId: req.id,
          method: req.method,
          url: req.originalUrl,
          duration: `${duration.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        })
      );
    }

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
