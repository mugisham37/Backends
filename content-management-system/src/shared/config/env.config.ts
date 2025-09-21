/**
 * Environment Configuration
 * Centralized configuration management with validation and type safety
 */

import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import { logger } from "../utils/logger";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Environment validation schema using Zod
 */
const envSchema = z.object({
  // Core server configuration
  NODE_ENV: z
    .enum(["development", "production", "staging", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("localhost"),

  // Database configuration
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("cms_dev"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default(""),
  DB_SSL: z.coerce.boolean().default(false),
  DB_MAX_CONNECTIONS: z.coerce.number().default(20),
  DB_CONNECTION_TIMEOUT: z.coerce.number().default(60000),
  DB_IDLE_TIMEOUT: z.coerce.number().default(300000),

  // Redis configuration
  REDIS_URI: z.string().default("redis://localhost:6379"),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_MAX_RETRIES: z.coerce.number().default(3),
  REDIS_CONNECT_TIMEOUT: z.coerce.number().default(10000),

  // JWT configuration
  JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT refresh secret must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_ISSUER: z.string().default("cms-api"),
  JWT_AUDIENCE: z.string().default("cms-users"),

  // Security configuration
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  SESSION_SECRET: z
    .string()
    .min(32, "Session secret must be at least 32 characters"),
  CSRF_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // CORS configuration
  CORS_ORIGIN: z.string().default("*"),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // File upload configuration
  UPLOAD_MAX_SIZE: z.coerce.number().default(10485760), // 10MB
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .default("image/*,application/pdf,text/*"),
  UPLOAD_DESTINATION: z.string().default("./uploads"),

  // Cache configuration
  CACHE_TTL: z.coerce.number().default(3600), // 1 hour
  CACHE_MAX_SIZE: z.coerce.number().default(1000),

  // Logging configuration
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  LOG_SILENT: z.coerce.boolean().default(false),

  // Monitoring configuration
  MONITORING_ENABLED: z.coerce.boolean().default(true),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),

  // Search configuration (Elasticsearch)
  ELASTICSEARCH_NODE: z.string().optional(),
  ELASTICSEARCH_AUTH: z.string().optional(),
  ELASTICSEARCH_INDEX: z.string().default("cms_content"),

  // CDN configuration
  CDN_BASE_URL: z.string().optional(),
  CDN_ACCESS_KEY: z.string().optional(),
  CDN_SECRET_KEY: z.string().optional(),

  // Email configuration
  EMAIL_PROVIDER: z.enum(["smtp", "sendgrid", "ses"]).default("smtp"),
  EMAIL_FROM: z.string().email().default("noreply@cms.local"),
  EMAIL_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // External API keys
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Application URLs
  APP_BASE_URL: z.string().url().optional(),
  API_BASE_URL: z.string().url().optional(),

  // Feature flags
  ENABLE_GRAPHQL: z.coerce.boolean().default(true),
  ENABLE_WEBHOOKS: z.coerce.boolean().default(true),
  ENABLE_AUDIT_LOGS: z.coerce.boolean().default(true),
  ENABLE_MULTI_TENANCY: z.coerce.boolean().default(true),
  ENABLE_MEDIA_PROCESSING: z.coerce.boolean().default(true),
});

/**
 * Validate and parse environment variables
 */
const parseEnvironment = () => {
  try {
    const env = envSchema.parse(process.env);
    logger.info("✅ Environment variables validated successfully");
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("❌ Environment validation failed:");
      error.errors.forEach((err) => {
        logger.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
    } else {
      logger.error("❌ Unexpected error during environment validation:", error);
    }
    process.exit(1);
  }
};

const env = parseEnvironment();

/**
 * Typed configuration object with all application settings
 */
export const config = {
  // Environment info
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isStaging: env.NODE_ENV === "staging",
  isTest: env.NODE_ENV === "test",

  // Server configuration
  port: env.PORT,
  host: env.HOST,

  // Database configuration
  database: {
    url: env.DATABASE_URL,
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    maxConnections: env.DB_MAX_CONNECTIONS,
    connectionTimeout: env.DB_CONNECTION_TIMEOUT,
    idleTimeout: env.DB_IDLE_TIMEOUT,
  },

  // Redis configuration
  redis: {
    uri: env.REDIS_URI,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    maxRetries: env.REDIS_MAX_RETRIES,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT,
    enabled: !!env.REDIS_URI,
  },

  // JWT configuration
  jwt: {
    accessSecret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    algorithm: "HS256" as const,
  },

  // Security configuration
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    sessionSecret: env.SESSION_SECRET,
    csrfEnabled: env.CSRF_ENABLED,
  },

  // CORS configuration
  cors: {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    credentials: env.CORS_CREDENTIALS,
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Tenant-ID",
      "X-API-Key",
      "X-Request-ID",
      "X-Correlation-ID",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
  },

  // Upload configuration
  upload: {
    maxFileSize: env.UPLOAD_MAX_SIZE,
    allowedMimeTypes: env.UPLOAD_ALLOWED_MIME_TYPES.split(",").map((t) =>
      t.trim()
    ),
    destination: env.UPLOAD_DESTINATION,
  },

  // Cache configuration
  cache: {
    ttl: env.CACHE_TTL,
    maxSize: env.CACHE_MAX_SIZE,
  },

  // Monitoring configuration
  monitoring: {
    enabled: env.MONITORING_ENABLED,
    metricsEnabled: env.METRICS_ENABLED,
    healthCheckTimeout: env.HEALTH_CHECK_TIMEOUT,
    logLevel: env.LOG_LEVEL,
    logSilent: env.LOG_SILENT,
  },

  // Search configuration
  search: {
    elasticsearch: {
      node: env.ELASTICSEARCH_NODE,
      auth: env.ELASTICSEARCH_AUTH,
      index: env.ELASTICSEARCH_INDEX,
      enabled: !!env.ELASTICSEARCH_NODE,
    },
  },

  // CDN configuration
  cdn: {
    baseUrl: env.CDN_BASE_URL,
    enabled: !!env.CDN_BASE_URL,
    accessKey: env.CDN_ACCESS_KEY,
    secretKey: env.CDN_SECRET_KEY,
  },

  // Email configuration
  email: {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    apiKey: env.EMAIL_API_KEY,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  },

  // Cloud configuration
  cloud: {
    google: {
      projectId: env.GOOGLE_CLOUD_PROJECT_ID,
    },
    aws: {
      region: env.AWS_REGION,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  },

  // Application URLs
  urls: {
    app: env.APP_BASE_URL || `http://${env.HOST}:${env.PORT}`,
    api: env.API_BASE_URL || `http://${env.HOST}:${env.PORT}/api`,
  },

  // Feature flags
  features: {
    graphql: env.ENABLE_GRAPHQL,
    webhooks: env.ENABLE_WEBHOOKS,
    auditLogs: env.ENABLE_AUDIT_LOGS,
    multiTenancy: env.ENABLE_MULTI_TENANCY,
    mediaProcessing: env.ENABLE_MEDIA_PROCESSING,
  },
} as const;

/**
 * Configuration validation for specific environments
 */
export const validateConfig = () => {
  const errors: string[] = [];

  // Production-specific validations
  if (config.isProduction) {
    if (
      config.jwt.accessSecret.includes("default") ||
      config.jwt.accessSecret.length < 32
    ) {
      errors.push("JWT secret must be properly configured for production");
    }

    if (
      config.security.sessionSecret.includes("default") ||
      config.security.sessionSecret.length < 32
    ) {
      errors.push("Session secret must be properly configured for production");
    }

    if (!config.database.ssl) {
      logger.warn("⚠️ Database SSL is disabled in production");
    }
  }

  // Database connectivity validation
  if (!config.database.url) {
    errors.push("Database URL is required");
  }

  if (errors.length > 0) {
    logger.error("❌ Configuration validation failed:");
    errors.forEach((error) => logger.error(`  - ${error}`));
    process.exit(1);
  }

  logger.info("✅ Configuration validation passed");
};

/**
 * Get configuration summary for logging
 */
export const getConfigSummary = () => ({
  environment: config.nodeEnv,
  port: config.port,
  database: {
    host: config.database.host,
    port: config.database.port,
    name: config.database.name,
    ssl: config.database.ssl,
  },
  redis: {
    enabled: config.redis.enabled,
  },
  features: config.features,
  monitoring: {
    enabled: config.monitoring.enabled,
    logLevel: config.monitoring.logLevel,
  },
});

// Validate configuration on module load
validateConfig();

export type Config = typeof config;
export default config;
