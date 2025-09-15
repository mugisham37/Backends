import winston from "winston"
import { config } from "../config"

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  silent: config.logging.silent,
  format: logFormat,
  defaultMeta: { service: "cms-api" },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta) : ""
          return `${timestamp} [${level}]: ${message} ${metaString}`
        }),
      ),
    }),
  ],
})

// Add file transports in production
if (config.isProduction) {
  logger.add(new winston.transports.File({ filename: "logs/error.log", level: "error" }))
  logger.add(new winston.transports.File({ filename: "logs/combined.log" }))
}

// Create a stream object for Morgan
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

// Export a simplified logger for use in development
export const devLogger = {
  info: (...args: any[]) => {
    if (config.isDevelopment) {
      console.info(...args)
    }
  },
  error: (...args: any[]) => {
    if (config.isDevelopment) {
      console.error(...args)
    }
  },
  warn: (...args: any[]) => {
    if (config.isDevelopment) {
      console.warn(...args)
    }
  },
  debug: (...args: any[]) => {
    if (config.isDevelopment) {
      console.debug(...args)
    }
  },
}
