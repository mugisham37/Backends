import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Environment validation
const requiredEnvVars = ["NODE_ENV"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Configuration object with strict typing
export const config = {
  // Server configuration
  port: Number.parseInt(process.env["PORT"] || "3000", 10),
  env: process.env["NODE_ENV"] || "development",
  environment: process.env["NODE_ENV"] || "development",
  isDevelopment: process.env["NODE_ENV"] === "development",
  isProduction: process.env["NODE_ENV"] === "production",
  isTest: process.env["NODE_ENV"] === "test",

  // Database configuration (PostgreSQL for modern setup)
  database: {
    url: process.env["DATABASE_URL"] || "postgresql://localhost:5432/cms_dev",
    host: process.env["DB_HOST"] || "localhost",
    port: Number.parseInt(process.env["DB_PORT"] || "5432", 10),
    name: process.env["DB_NAME"] || "cms_dev",
    user: process.env["DB_USER"] || "postgres",
    password: process.env["DB_PASSWORD"] || "",
    ssl: process.env["DB_SSL"] === "true",
    maxConnections: Number.parseInt(
      process.env["DB_MAX_CONNECTIONS"] || "20",
      10
    ),
  },

  // Legacy MongoDB configuration (for migration compatibility)
  mongodb: {
    uri: process.env["MONGODB_URI"] || "",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Redis configuration
  redis: {
    enabled: !!process.env["REDIS_URI"],
    uri: process.env["REDIS_URI"] || "redis://localhost:6379",
    password: process.env["REDIS_PASSWORD"] || undefined,
    db: Number.parseInt(process.env["REDIS_DB"] || "0", 10),
    maxRetriesPerRequest: Number.parseInt(
      process.env["REDIS_MAX_RETRIES"] || "3",
      10
    ),
  },

  // JWT configuration
  jwt: {
    secret:
      process.env["JWT_SECRET"] || "default-dev-secret-change-in-production",
    refreshSecret:
      process.env["JWT_REFRESH_SECRET"] ||
      process.env["JWT_SECRET"] ||
      "default-dev-secret-change-in-production",
    expiresIn: process.env["JWT_EXPIRES_IN"] || "1d",
    refreshExpiresIn: process.env["JWT_REFRESH_EXPIRES_IN"] || "7d",
    accessTokenExpiry: process.env["JWT_EXPIRES_IN"] || "1d",
    refreshTokenExpiry: process.env["JWT_REFRESH_EXPIRES_IN"] || "7d",
    algorithm: "HS256" as const,
    issuer: process.env["JWT_ISSUER"] || "cms-api",
    audience: process.env["JWT_AUDIENCE"] || "cms-users",
  },

  // Search configuration (for future Elasticsearch integration)
  search: {
    enabled: !!process.env["ELASTICSEARCH_NODE"],
    node: process.env["ELASTICSEARCH_NODE"] || "http://localhost:9200",
    auth: process.env["ELASTICSEARCH_AUTH"],
    index: process.env["ELASTICSEARCH_INDEX"] || "cms_content",
  },

  // Logging configuration
  logging: {
    level: (process.env["LOG_LEVEL"] || "info") as
      | "trace"
      | "debug"
      | "info"
      | "warn"
      | "error"
      | "fatal",
    silent: process.env["LOG_SILENT"] === "true",
    prettyPrint: process.env["NODE_ENV"] === "development",
  },

  // CORS configuration
  cors: {
    origin: process.env["CORS_ORIGIN"]?.split(",") || true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Tenant-ID",
      "X-API-Key",
      "X-Request-ID",
    ],
    credentials: true,
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: Number.parseInt(
      process.env["RATE_LIMIT_WINDOW_MS"] || "900000",
      10
    ), // 15 minutes
    max: Number.parseInt(process.env["RATE_LIMIT_MAX"] || "100", 10),
    standardHeaders: true,
    legacyHeaders: false,
  },

  // File upload configuration
  upload: {
    maxSize: Number.parseInt(process.env["UPLOAD_MAX_SIZE"] || "10485760", 10), // 10MB
    allowedMimeTypes: (
      process.env["UPLOAD_ALLOWED_MIME_TYPES"] || "image/*,application/pdf"
    ).split(","),
    destination: process.env["UPLOAD_DESTINATION"] || "./uploads",
  },

  // Security configuration
  security: {
    bcryptRounds: Number.parseInt(process.env["BCRYPT_ROUNDS"] || "12", 10),
    sessionSecret:
      process.env["SESSION_SECRET"] ||
      "default-session-secret-change-in-production",
    csrfEnabled: process.env["CSRF_ENABLED"] !== "false",
  },

  // Cache configuration
  cache: {
    ttl: Number.parseInt(process.env["CACHE_TTL"] || "3600", 10), // 1 hour
    maxSize: Number.parseInt(process.env["CACHE_MAX_SIZE"] || "100", 10), // 100 items
  },
} as const;
