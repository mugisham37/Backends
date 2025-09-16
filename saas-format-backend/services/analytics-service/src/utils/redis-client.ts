import Redis from "ioredis"
import { logger } from "./logger"

// Create Redis client
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

// Handle Redis connection events
redisClient.on("connect", () => {
  logger.info("Redis client connected")
})

redisClient.on("error", (err) => {
  logger.error("Redis client error:", err)
})

export default redisClient
