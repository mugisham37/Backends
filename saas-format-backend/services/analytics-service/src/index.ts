import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import { errorHandler } from "./middleware/error-handler"
import { notFoundHandler } from "./middleware/not-found-handler"
import { authMiddleware } from "./middleware/auth-middleware"
import { tenantMiddleware } from "./middleware/tenant-middleware"
import eventRoutes from "./routes/event-routes"
import metricRoutes from "./routes/metric-routes"
import reportRoutes from "./routes/report-routes"
import dashboardRoutes from "./routes/dashboard-routes"
import usageRoutes from "./routes/usage-routes"
import { setupKafkaConsumers } from "./messaging/kafka-consumers"
import { logger } from "./utils/logger"

// Initialize express app
const app = express()
const port = process.env.PORT || 3006

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(morgan("combined"))

// API routes
app.use("/api/analytics/events", authMiddleware, tenantMiddleware, eventRoutes)
app.use("/api/analytics/metrics", authMiddleware, tenantMiddleware, metricRoutes)
app.use("/api/analytics/reports", authMiddleware, tenantMiddleware, reportRoutes)
app.use("/api/analytics/dashboards", authMiddleware, tenantMiddleware, dashboardRoutes)
app.use("/api/analytics/usage", authMiddleware, tenantMiddleware, usageRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
app.listen(port, () => {
  logger.info(`Analytics service running on port ${port}`)

  // Set up Kafka consumers
  setupKafkaConsumers().catch((error) => {
    logger.error("Failed to set up Kafka consumers:", error)
  })
})

export default app
