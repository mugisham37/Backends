import Redis from "ioredis"
import { logger } from "./logger"

// Create Redis client
const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

// Handle Redis errors
redisClient.on("error", (err) => {
  logger.error(`Redis Error: ${err}`)
})

// Log when connected
redisClient.on("connect", () => {
  logger.info("Connected to Redis")
})

export default redisClient
