import dotenv from "dotenv"
import mongoose from "mongoose"
import app from "./app"
import logger from "./config/logger"
import { initScheduler, stopAllJobs } from "./services/scheduler.service"
import { closeRedisConnection } from "./config/redis"
import { initializeDefaultSettings } from "./services/settings.service"

// Load environment variables
dotenv.config()

// Set up unhandled rejection handler
process.on("unhandledRejection", (err: Error) => {
  logger.error(`Unhandled Rejection: ${err.message}`)
  logger.error(err.stack)

  // Graceful shutdown
  gracefulShutdown("Unhandled Rejection")
})

// Set up uncaught exception handler
process.on("uncaughtException", (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`)
  logger.error(err.stack)

  // For uncaught exceptions, we should exit immediately
  process.exit(1)
})

// Connect to MongoDB
const connectDB = async (): Promise<mongoose.Connection> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ecommerce", {
      serverSelectionTimeoutMS: 5000, // 5 seconds
    })
    logger.info(`MongoDB Connected: ${conn.connection.host}`)
    return conn.connection
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`)
    throw error
  }
}

// Graceful shutdown function
const gracefulShutdown = async (reason: string): Promise<void> => {
  logger.info(`Server is shutting down: ${reason}`)

  try {
    // Stop all scheduled jobs
    logger.info("Stopping all scheduled jobs")
    await stopAllJobs()

    // Close Redis connection
    logger.info("Closing Redis connection")
    await closeRedisConnection()

    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      logger.info("Closing MongoDB connection")
      await mongoose.connection.close()
    }

    logger.info("All connections closed successfully")
    process.exit(0)
  } catch (error) {
    logger.error(`Error during graceful shutdown: ${error.message}`)
    process.exit(1)
  }
}

// Handle termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM received"))
process.on("SIGINT", () => gracefulShutdown("SIGINT received"))

// Start server
const startServer = async (): Promise<any> => {
  try {
    // Connect to MongoDB
    const dbConnection = await connectDB()

    // Initialize default settings
    try {
      await initializeDefaultSettings()
    } catch (error) {
      logger.error(`Error initializing default settings: ${error.message}`)
      // Continue starting the server even if settings initialization fails
    }

    // Set up connection error handler
    dbConnection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}`)
      gracefulShutdown("MongoDB connection error")
    })

    // Set up connection close handler
    dbConnection.on("close", () => {
      logger.info("MongoDB connection closed")
    })

    // Initialize scheduler
    initScheduler()

    // Start server
    const PORT = process.env.PORT || 5000
    const server = app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
    })

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        logger.error(`Port ${PORT} is already in use`)
      } else {
        logger.error(`Server error: ${error.message}`)
      }
      process.exit(1)
    })

    return server
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`)
    process.exit(1)
  }
}

// Start the server
startServer()
