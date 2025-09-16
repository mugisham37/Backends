import pino from "pino";
import { config } from "../config";

// Create Pino logger instance (optimized for Fastify)
export const logger = pino({
  level: config.logging.level,
  ...(config.logging.prettyPrint && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        singleLine: true,
      },
    },
  }),
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: {
    service: "cms-api",
    version: process.env["npm_package_version"] || "1.0.0",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Database logger
export const dbLogger = createModuleLogger("database");

// Auth logger
export const authLogger = createModuleLogger("auth");

// API logger
export const apiLogger = createModuleLogger("api");

// Cache logger
export const cacheLogger = createModuleLogger("cache");

// Export logger for backward compatibility and development
export const devLogger = {
  info: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.info(message, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.error(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.warn(message, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (config.isDevelopment) {
      logger.debug(message, ...args);
    }
  },
};
