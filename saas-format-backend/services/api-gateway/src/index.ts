import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import morgan from "morgan"
import { rateLimit } from "express-rate-limit"
import { createProxyMiddleware } from "http-proxy-middleware"

import { logger } from "./utils/logger"
import { errorHandler } from "./middleware/error-handler"
import { tenantExtractor } from "./middleware/tenant-extractor"
import { authMiddleware } from "./middleware/auth-middleware"
import { notFoundHandler } from "./middleware/not-found-handler"
import { cacheMiddleware } from "./middleware/cache-middleware"

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()
const port = process.env.PORT || 3000

// Apply middleware
app.use(helmet()) // Security headers
app.use(compression()) // Compress responses
app.use(cors()) // Enable CORS
app.use(express.json()) // Parse JSON bodies
app.use(express.urlencoded({ extended: true })) // Parse URL-encoded bodies

// Request logging
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }))

// Rate limiting
const limiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
  max: Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
})

// Extract tenant information
app.use(tenantExtractor)

// Public routes
// Auth Service Proxy - no auth required
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
    changeOrigin: true,
    pathRewrite: {
      "^/api/auth": "/api/auth",
    },
  }),
)

// Tenant Service Proxy - public endpoints
app.use(
  "/api/tenants",
  createProxyMiddleware({
    target: process.env.TENANT_SERVICE_URL || "http://tenant-service:3002",
    changeOrigin: true,
    pathRewrite: {
      "^/api/tenants": "/api/tenants",
    },
  }),
)

// Protected routes - require authentication
app.use(authMiddleware)

// User Service Proxy
app.use(
  "/api/users",
  cacheMiddleware("users", 60), // Cache for 60 seconds
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL || "http://user-service:3003",
    changeOrigin: true,
    pathRewrite: {
      "^/api/users": "/api/users",
    },
  }),
)

// Project Service Proxy
app.use(
  "/api/projects",
  createProxyMiddleware({
    target: process.env.PROJECT_SERVICE_URL || "http://project-service:3004",
    changeOrigin: true,
    pathRewrite: {
      "^/api/projects": "/api/projects",
    },
  }),
)

// Billing Service Proxy
app.use(
  "/api/billing",
  createProxyMiddleware({
    target: process.env.BILLING_SERVICE_URL || "http://billing-service:3005",
    changeOrigin: true,
    pathRewrite: {
      "^/api/billing": "/api/billing",
    },
  }),
)

// Feature Flag Service Proxy
app.use(
  "/api/features",
  cacheMiddleware("features", 30), // Cache for 30 seconds
  createProxyMiddleware({
    target: process.env.FEATURE_SERVICE_URL || "http://feature-service:3006",
    changeOrigin: true,
    pathRewrite: {
      "^/api/features": "/api/features",
    },
  }),
)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
app.listen(port, () => {
  logger.info(`API Gateway running on port ${port}`)
})

export default app
