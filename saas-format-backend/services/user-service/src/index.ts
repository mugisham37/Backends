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
import userRoutes from "./routes/user-routes"
import profileRoutes from "./routes/profile-routes"
import preferenceRoutes from "./routes/preference-routes"

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()
const port = process.env.PORT || 3003

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

// Protected routes
app.use(authMiddleware)
app.use("/api/users", userRoutes)
app.use("/api/profiles", profileRoutes)
app.use("/api/preferences", preferenceRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
const server = app.listen(port, async () => {
  logger.info(`User Service running on port ${port}`)

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
