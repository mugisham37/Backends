import { createClient } from "redis"
import { logger } from "./logger"

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
})

// Handle Redis connection
redisClient.on("connect", () => {
  logger.info("Connected to Redis")
})

redisClient.on("error", (error) => {
  logger.error(`Redis error: ${error.message}`)
})

// Connect to Redis
redisClient.connect().catch((error) => {
  logger.error(`Failed to connect to Redis: ${error.message}`)
})

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing Redis connection")
  await redisClient.quit()
  logger.info("Redis connection closed")
})

export default redisClient
