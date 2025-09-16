import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../.env") })

// Environment
const environment = process.env.NODE_ENV || "development"

// Configuration object
export const config = {
  environment,
  port: Number.parseInt(process.env.PORT || "3000", 10),
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : ["http://localhost:3000"],

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m",
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d",
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/saas_platform",
    ssl: process.env.DATABASE_SSL === "true",
  },

  // Redis configuration
  redis: {
    enabled: process.env.REDIS_ENABLED === "true",
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  // Kafka configuration
  kafka: {
    enabled: process.env.KAFKA_ENABLED === "true",
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(",") : ["localhost:9092"],
    clientId: process.env.KAFKA_CLIENT_ID || "saas-platform",
  },

  // Email configuration
  email: {
    from: process.env.EMAIL_FROM || "noreply@example.com",
    smtp: {
      host: process.env.EMAIL_SMTP_HOST || "smtp.example.com",
      port: Number.parseInt(process.env.EMAIL_SMTP_PORT || "587", 10),
      secure: process.env.EMAIL_SMTP_SECURE === "true",
      auth: {
        user: process.env.EMAIL_SMTP_USER || "",
        pass: process.env.EMAIL_SMTP_PASS || "",
      },
    },
  },

  // Storage configuration
  storage: {
    type: process.env.STORAGE_TYPE || "local", // local, s3, azure
    local: {
      path: process.env.STORAGE_LOCAL_PATH || path.join(__dirname, "../uploads"),
    },
    s3: {
      bucket: process.env.STORAGE_S3_BUCKET || "",
      region: process.env.STORAGE_S3_REGION || "",
      accessKey: process.env.STORAGE_S3_ACCESS_KEY || "",
      secretKey: process.env.STORAGE_S3_SECRET_KEY || "",
    },
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "json",
  },

  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    currency: process.env.STRIPE_CURRENCY || "usd",
    plans: {
      free: process.env.STRIPE_FREE_PLAN_ID || "",
      starter: process.env.STRIPE_STARTER_PLAN_ID || "",
      pro: process.env.STRIPE_PRO_PLAN_ID || "",
      enterprise: process.env.STRIPE_ENTERPRISE_PLAN_ID || "",
    },
  },

  // Security configuration
  security: {
    csrfProtection: process.env.CSRF_PROTECTION === "true",
    csrfCookieName: process.env.CSRF_COOKIE_NAME || "csrf",
    csrfHeaderName: process.env.CSRF_HEADER_NAME || "X-CSRF-Token",
    rateLimiting: {
      enabled: process.env.RATE_LIMITING_ENABLED === "true",
      windowMs: Number.parseInt(process.env.RATE_LIMITING_WINDOW_MS || "900000", 10), // 15 minutes
      max: Number.parseInt(process.env.RATE_LIMITING_MAX || "100", 10), // 100 requests per windowMs
    },
  },

  // Feature flags
  features: {
    analytics: process.env.FEATURE_ANALYTICS === "true",
    billing: process.env.FEATURE_BILLING === "true",
    featureFlags: process.env.FEATURE_FLAGS === "true",
    multiTenancy: process.env.FEATURE_MULTI_TENANCY === "true",
  },
}
