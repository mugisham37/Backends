import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

// Environment validation
const requiredEnvVars = ["NODE_ENV", "MONGODB_URI"]
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`)
}

// Configuration object
export const config = {
  // Server configuration
  port: Number.parseInt(process.env.PORT || "3000", 10),
  environment: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",

  // Database configuration
  mongodb: {
    uri: process.env.MONGODB_URI as string,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Redis configuration (optional)
  redis: {
    enabled: !!process.env.REDIS_URI,
    uri: process.env.REDIS_URI || "",
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || "default-dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Elasticsearch configuration (optional)
  elasticsearch: {
    enabled: !!process.env.ELASTICSEARCH_NODE,
    node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
    auth: process.env.ELASTICSEARCH_AUTH || undefined,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    silent: process.env.LOG_SILENT === "true",
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: process.env.CORS_METHODS || "GET,HEAD,PUT,PATCH,POST,DELETE",
  },

  // Rate limiting
  rateLimit: {
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // limit each IP to 100 requests per windowMs
  },

  // File upload configuration
  upload: {
    maxSize: Number.parseInt(process.env.UPLOAD_MAX_SIZE || "10485760", 10), // 10MB
    allowedMimeTypes: (process.env.UPLOAD_ALLOWED_MIME_TYPES || "image/*,application/pdf").split(","),
  },
}
