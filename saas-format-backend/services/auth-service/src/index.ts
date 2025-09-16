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

// Import routes
import authRoutes from "./routes/auth-routes"

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()
const port = process.env.PORT || 3001

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

// API routes
app.use("/api/auth", authRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
app.listen(port, () => {
  logger.info(`Auth Service running on port ${port}`)
})

export default app
