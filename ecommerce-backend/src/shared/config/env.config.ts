/**
 * Environment configuration
 * Centralized configuration management with validation
 */

import { z } from "zod";
import { logger } from "../utils/logger.js";

const envSchema = z.object({
  // Server
  PORT: z.string().transform(Number).default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_VERSION: z.string().default("v1"),

  // Database
  DATABASE_URL: z.string().url(),
  DB_MAX_CONNECTIONS: z.string().transform(Number).default("20"),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_MAX_RETRIES: z.string().transform(Number).default("3"),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default("10485760"), // 10MB
  ALLOWED_FILE_TYPES: z
    .string()
    .default("image/jpeg,image/png,image/webp,application/pdf"),

  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default("12"),
  SESSION_SECRET: z.string().min(32).optional(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default("100"),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default("900000"), // 15 minutes

  // Monitoring
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  ENABLE_METRICS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
});

function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    logger.error("❌ Invalid environment configuration:", error);
    process.exit(1);
  }
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  apiVersion: process.env.API_VERSION || "v1",

  database: {
    url:
      process.env.DATABASE_URL || "postgresql://localhost:5432/ecommerce_dev",
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 20,
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB) || 0,
    maxRetries: Number(process.env.REDIS_MAX_RETRIES) || 3,
  },

  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      "development-access-secret-key-change-in-production",
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      "development-refresh-secret-key-change-in-production",
  },

  email: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  upload: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10485760,
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(",") || [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },

  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    sessionSecret: process.env.SESSION_SECRET,
  },

  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    window: Number(process.env.RATE_LIMIT_WINDOW) || 900000,
  },

  monitoring: {
    logLevel: process.env.LOG_LEVEL || "info",
    enableMetrics: process.env.ENABLE_METRICS === "true",
  },
};

// Validate environment in production
if (config.nodeEnv === "production") {
  validateEnv();
}
