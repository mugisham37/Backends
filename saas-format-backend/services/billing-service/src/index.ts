import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import morgan from "morgan"
import { rateLimit } from "express-rate-limit"

import { logger } from "./utils/logger"
import { errorHandler } from "./middleware/error-handler"
import { notFoundHandler } from "./middleware/not-found-handler"
import { authMiddleware } from "./middleware/auth-middleware"
import { initKafkaConsumers } from "./messaging/kafka-consumers"
import { initProducer } from "./utils/kafka-client"

// Import routes
import subscriptionRoutes from "./routes/subscription-routes"
import planRoutes from "./routes/plan-routes"
import webhookRoutes from "./routes/webhook-routes"
import usageRoutes from "./routes/usage-routes"
import invoiceRoutes from "./routes/invoice-routes"

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()
const port = process.env.PORT || 3005

// Apply middleware
app.use(helmet()) // Security headers
app.use(compression()) // Compress responses
app.use(cors()) // Enable CORS

// Parse JSON bodies except for webhook route
app.use((req, res, next) => {
  if (req.originalUrl === "/api/billing/webhooks") {
    next()
  } else {
    express.json()(req, res, next)
  }
})

app.use(express.urlencoded({ extended: true })) // Parse URL-encoded bodies

// Request logging
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
})

// Webhook route - no auth required, raw body
app.use("/api/billing/webhooks", webhookRoutes)

// Protected routes
app.use(authMiddleware)
app.use("/api/billing/subscriptions", subscriptionRoutes)
app.use("/api/billing/plans", planRoutes)
app.use("/api/billing/usage", usageRoutes)
app.use("/api/billing/invoices", invoiceRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
const server = app.listen(port, async () => {
  logger.info(`Billing Service running on port ${port}`)

  // Initialize Kafka producer
  await initProducer()

  // Initialize Kafka consumers
  await initKafkaConsumers()
})

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server")
  server.close(() => {
    logger.info("HTTP server closed")
  })
})

export default app
