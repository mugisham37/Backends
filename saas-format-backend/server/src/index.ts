import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import cookieParser from "cookie-parser"
import { rateLimit } from "express-rate-limit"
import { createClient } from "redis"
import RedisStore from "rate-limit-redis"
import { errorHandler } from "./middleware/error-handler"
import { notFoundHandler } from "./middleware/not-found-handler"
import { setupSwagger } from "./docs/swagger"
import { logger } from "./utils/logger"
import { config } from "./config"

// Import routes
import authRoutes from "./routes/auth-routes"
import userRoutes from "./routes/user-routes"
import tenantRoutes from "./routes/tenant-routes"
import projectRoutes from "./routes/project-routes"
import taskRoutes from "./routes/task-routes"

// Create Express server
const app = express()

// Redis client for rate limiting
let redisClient
let limiter

// Setup rate limiting
if (config.redis.enabled) {
  redisClient = createClient({
    url: config.redis.url,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
    },
  })

  redisClient.on("error", (err) => {
    logger.error("Redis error:", err)
  })

  redisClient.connect().catch((err) => {
    logger.error("Redis connection error:", err)
  })

  limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    message: {
      status: "error",
      message: "Too many requests, please try again later.",
    },
  })
} else {
  limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      message: "Too many requests, please try again later.",
    },
  })
}

// Express configuration
app.set("port", config.port)
app.set("trust proxy", 1) // Trust first proxy

// Middleware
app.use(helmet()) // Security headers
app.use(compression()) // Compress responses
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"],
    exposedHeaders: ["X-Total-Count", "X-Total-Pages"],
  }),
)
app.use(express.json({ limit: "10mb" })) // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" })) // Parse URL-encoded bodies
app.use(cookieParser()) // Parse cookies
app.use(limiter) // Apply rate limiting

// Setup Swagger documentation
setupSwagger(app)

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/tenants", tenantRoutes)
app.use("/api/projects", projectRoutes)
app.use("/api/tasks", taskRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
app.listen(app.get("port"), () => {
  logger.info(`Server running at http://localhost:${app.get("port")} in ${app.get("env")} mode`)
})

export default app
