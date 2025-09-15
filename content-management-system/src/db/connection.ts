import mongoose from "mongoose"
import { config } from "../config"
import { logger } from "../utils/logger"

// Connect to MongoDB
export const connectDatabase = async (): Promise<void> => {
  try {
    logger.info("Connecting to MongoDB...")

    // Set mongoose options
    mongoose.set("strictQuery", true)

    // Connect to the database
    await mongoose.connect(config.mongodb.uri)

    logger.info("MongoDB connected successfully")

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected")
    })

    // Handle process termination
    process.on("SIGINT", async () => {
      try {
        await mongoose.connection.close()
        logger.info("MongoDB connection closed due to app termination")
        process.exit(0)
      } catch (err) {
        logger.error("Error closing MongoDB connection:", err)
        process.exit(1)
      }
    })
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error)
    throw error
  }
}

// Disconnect from MongoDB
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close()
    logger.info("MongoDB disconnected")
  } catch (error) {
    logger.error("Error disconnecting from MongoDB:", error)
    throw error
  }
}
