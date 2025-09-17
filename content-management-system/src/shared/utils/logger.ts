import pino from "pino";
import { config } from "../config";
import { LOG_LEVELS } from "../constants";

/**
 * Perfect Logger Interface - Comprehensive logging capabilities
 */
export interface Logger {
  trace(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  fatal(message: string, ...args: any[]): void;
  child(context: Record<string, any>): Logger;
}

/**
 * Enhanced Pino logger configuration with performance optimizations
 */
const createPinoLogger = () => {
  const loggerConfig: any = {
    level: config.logging.level || LOG_LEVELS.INFO,
    timestamp: pino.stdTimeFunctions.isoTime,

    // Base context for all logs
    base: {
      service: config.app.name || "cms-api",
      version:
        config.app.version || process.env["npm_package_version"] || "1.0.0",
      environment: config.env,
      pid: process.pid,
      hostname: process.env["HOSTNAME"] || "localhost",
    },

    // Standard serializers for better log formatting
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },

    // Custom formatters for better readability
    formatters: {
      level: (label: string) => {
        return { level: label.toUpperCase() };
      },
      log: (object: any) => {
        // Add correlation ID if available
        if (object.correlationId) {
          return { ...object, correlationId: object.correlationId };
        }
        return object;
      },
    },

    // Silent mode for testing
    ...(config.logging.silent && { silent: true }),
  };

  // Pretty print for development
  if (config.logging.prettyPrint && config.isDevelopment) {
    loggerConfig.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l Z",
        ignore: "pid,hostname",
        singleLine: false,
        hideObject: false,
        messageFormat: "{service}[{module}] {msg}",
        errorLikeObjectKeys: ["err", "error"],
      },
    };
  }

  // Production optimization - destination streaming
  if (config.isProduction) {
    loggerConfig.redact = {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "password",
        "token",
        "secret",
        "key",
      ],
      censor: "[REDACTED]",
    };
  }

  return pino(loggerConfig);
};

// Create the main logger instance
const pinoLogger = createPinoLogger();

/**
 * Perfect Logger Implementation - Wraps Pino with enhanced capabilities
 */
class PerfectLogger implements Logger {
  private pino: pino.Logger;
  private context: Record<string, any>;

  constructor(pinoInstance: pino.Logger, context: Record<string, any> = {}) {
    this.pino = pinoInstance;
    this.context = context;
  }

  trace(message: string, ...args: any[]): void {
    this.log("trace", message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log("debug", message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log("warn", message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log("error", message, ...args);
  }

  fatal(message: string, ...args: any[]): void {
    this.log("fatal", message, ...args);
  }

  child(context: Record<string, any>): Logger {
    const mergedContext = { ...this.context, ...context };
    return new PerfectLogger(this.pino.child(context), mergedContext);
  }

  private log(level: string, message: string, ...args: any[]): void {
    const logData: any = { ...this.context };

    // Handle different argument types
    if (args.length > 0) {
      const lastArg = args[args.length - 1];

      // If last argument is an object, merge it as context
      if (
        typeof lastArg === "object" &&
        lastArg !== null &&
        !Array.isArray(lastArg)
      ) {
        Object.assign(logData, lastArg);
        args.pop();
      }

      // If there are remaining args, add them as additional data
      if (args.length > 0) {
        logData.args = args;
      }
    }

    // Add timestamp and correlation ID
    logData.timestamp = new Date().toISOString();

    // Call appropriate Pino method
    (this.pino as any)[level](logData, message);
  }
}

// Create the main logger instance
export const logger = new PerfectLogger(pinoLogger);

/**
 * Create a child logger with additional context
 * Enhanced version that supports both string and object contexts
 */
export const createLogger = (context: Record<string, any> | string): Logger => {
  if (typeof context === "string") {
    return logger.child({ module: context });
  }
  return logger.child(context);
};

/**
 * Create a module-specific logger
 */
export const createModuleLogger = (
  module: string,
  additionalContext?: Record<string, any>
): Logger => {
  const context = { module, ...additionalContext };
  return logger.child(context);
};

// Pre-configured module loggers for common use cases
export const dbLogger = createModuleLogger("database");
export const authLogger = createModuleLogger("auth");
export const apiLogger = createModuleLogger("api");
export const cacheLogger = createModuleLogger("cache");
export const auditLogger = createModuleLogger("audit");
export const mediaLogger = createModuleLogger("media");
export const searchLogger = createModuleLogger("search");
export const webhookLogger = createModuleLogger("webhook");
export const tenantLogger = createModuleLogger("tenant");

/**
 * Request logger with correlation ID support
 */
export const createRequestLogger = (
  requestId: string,
  userId?: string,
  tenantId?: string
): Logger => {
  return logger.child({
    module: "request",
    requestId,
    ...(userId && { userId }),
    ...(tenantId && { tenantId }),
  });
};

/**
 * Performance logger for timing operations
 */
export const createPerformanceLogger = (operation: string): Logger => {
  return logger.child({
    module: "performance",
    operation,
    startTime: Date.now(),
  });
};

/**
 * Development logger (only logs in development mode)
 * Maintains backward compatibility with the old simple logger
 */
export const devLogger = {
  trace: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.trace(message, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.debug(message, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.info(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.warn(message, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.error(message, ...args);
    }
  },
  fatal: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.fatal(message, ...args);
    }
  },
};

/**
 * Structured logging helpers
 */
export const logHelpers = {
  // Log HTTP requests
  logRequest: (
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: string
  ) => {
    apiLogger.info("HTTP Request", {
      http: { method, url, statusCode, duration },
      userId,
    });
  },

  // Log database operations
  logDbOperation: (
    operation: string,
    table: string,
    duration: number,
    recordCount?: number
  ) => {
    dbLogger.debug("Database Operation", {
      database: { operation, table, duration, recordCount },
    });
  },

  // Log authentication events
  logAuthEvent: (
    event: string,
    userId: string,
    success: boolean,
    reason?: string
  ) => {
    authLogger.info("Authentication Event", {
      auth: { event, userId, success, reason },
    });
  },

  // Log cache operations
  logCacheOperation: (
    operation: string,
    key: string,
    hit: boolean,
    ttl?: number
  ) => {
    cacheLogger.debug("Cache Operation", {
      cache: { operation, key, hit, ttl },
    });
  },

  // Log errors with context
  logError: (error: Error, context?: Record<string, any>) => {
    logger.error("Application Error", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  },
};

// Export constants for log levels
export { LOG_LEVELS };
