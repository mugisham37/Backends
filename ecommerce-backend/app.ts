import express, { type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import rateLimit from "express-rate-limit"
import mongoSanitize from "express-mongo-sanitize"
import compression from "compression"
import path from "path"
import cookieParser from "cookie-parser"
import { errorHandler } from "./middleware/error.middleware"
import { requestId } from "./middleware/request-id.middleware"
import { languageMiddleware } from "./middleware/language.middleware"
import { ApiError } from "./utils/api-error"
import routes from "./routes"
import logger, { createRequestLogger } from "./config/logger"

// Initialize express app
const app = express()

// Add request ID middleware
app.use(requestId)

// Set security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  }),
)

// Enable CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  }),
)

// Cookie parser
app.use(cookieParser())

// Language middleware
app.use(languageMiddleware)

// Special handling for webhook routes - must come before body parser
// This ensures webhook signatures can be verified with raw body
const webhookBodyParser = express.raw({ type: "application/json" })
app.use("/api/v1/webhooks", (req, res, next) => {
  if (req.path.includes("/stripe") || req.path.includes("/paypal")) {
    webhookBodyParser(req, res, next)
  } else {
    next()
  }
})

// Body parser for all other routes
app.use(express.json({ limit: "10kb" }))
app.use(express.urlencoded({ extended: true, limit: "10kb" }))

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Compression
app.use(compression())

// Serve static files with cache control
app.use(
  express.static(path.join(__dirname, "../public"), {
    maxAge: "1d", // Cache static files for 1 day
    setHeaders: (res, filePath) => {
      // Set different cache times based on file type
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "public, max-age=0")
      } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        res.setHeader("Cache-Control", "public, max-age=86400") // 1 day
      } else if (filePath.match(/\.(css|js)$/)) {
        res.setHeader("Cache-Control", "public, max-age=31536000") // 1 year
      }
    },
  }),
)

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"))
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message: string) => {
          const trimmedMessage = message.trim()
          logger.http(trimmedMessage)
        },
      },
    }),
  )
}

// Rate limiting
const authLimiter = rateLimit({
  max: process.env.NODE_ENV === "production" ? 10 : 100, // 10 requests per IP in production, 100 in development
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: "Too many requests from this IP, please try again after 15 minutes!",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip || "unknown",
})

const apiLimiter = rateLimit({
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // 100 requests per IP in production, 1000 in development
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: "Too many requests from this IP, please try again after 15 minutes!",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip || "unknown",
})

// Exclude webhooks and docs from rate limiting
app.use(/\/api\/v1\/(?!webhooks|docs).*/, (req, res, next) => {
  if (req.path.startsWith("/api/v1/auth")) {
    authLimiter(req, res, next)
  } else {
    apiLimiter(req, res, next)
  }
})

// API routes
app.use("/api/v1", routes)

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Health check endpoint called")

  res.status(200).json({
    status: "success",
    message: "Server is running",
    requestId: req.id,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    language: req.language,
    version: process.env.npm_package_version || "1.0.0",
  })
})

// Handle undefined routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.warn(`Route not found: ${req.originalUrl}`)

  next(new ApiError(`Can't find ${req.originalUrl} on this server!`, 404))
})

// Global error handler
app.use(errorHandler)

export default app
