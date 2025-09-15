import { createApp } from "./app"
import { logger } from "./utils/logger"
import { config } from "./config"

async function startServer() {
  try {
    const app = await createApp()

    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`)
      logger.info(`Environment: ${config.env}`)
      logger.info(`API documentation available at http://localhost:${config.port}/api-docs`)
    })

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`)

      server.close(() => {
        logger.info("HTTP server closed")
        process.exit(0)
      })

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down")
        process.exit(1)
      }, 10000)
    }

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
    process.on("SIGINT", () => gracefulShutdown("SIGINT"))

    // Handle uncaught exceptions and rejections
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception:", err)
      gracefulShutdown("Uncaught exception")
    })

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection:", reason)
      gracefulShutdown("Unhandled rejection")
    })
  } catch (error) {
    logger.error("Error starting server:", error)
    process.exit(1)
  }
}

startServer()
