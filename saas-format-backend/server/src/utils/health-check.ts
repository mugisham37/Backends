import type { Request, Response } from "express"
import { getRedisClient } from "./redis-cache"
import { prisma } from "./prisma"
import { logger } from "./logger"
import { config } from "../config"

// Health check status
export enum HealthStatus {
  UP = "UP",
  DOWN = "DOWN",
  DEGRADED = "DEGRADED",
}

// Health check result
interface HealthCheckResult {
  status: HealthStatus
  timestamp: string
  version: string
  services: Record<
    string,
    {
      status: HealthStatus
      responseTime?: number
      error?: string
    }
  >
}

// Check database health
const checkDatabase = async (): Promise<{ status: HealthStatus; responseTime?: number; error?: string }> => {
  const start = Date.now()
  try {
    // Execute a simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - start
    return { status: HealthStatus.UP, responseTime }
  } catch (error) {
    logger.error("Database health check failed:", error)
    return { status: HealthStatus.DOWN, error: error.message }
  }
}

// Check Redis health
const checkRedis = async (): Promise<{ status: HealthStatus; responseTime?: number; error?: string }> => {
  if (!config.redis.enabled) {
    return { status: HealthStatus.UP, responseTime: 0 }
  }

  const start = Date.now()
  try {
    const client = getRedisClient()
    await client.ping()
    const responseTime = Date.now() - start
    return { status: HealthStatus.UP, responseTime }
  } catch (error) {
    logger.error("Redis health check failed:", error)
    return { status: HealthStatus.DOWN, error: error.message }
  }
}

// Check Kafka health
const checkKafka = async (): Promise<{ status: HealthStatus; responseTime?: number; error?: string }> => {
  if (!config.kafka.enabled) {
    return { status: HealthStatus.UP, responseTime: 0 }
  }

  // Implement Kafka health check if needed
  return { status: HealthStatus.UP, responseTime: 0 }
}

// Check external services health
const checkExternalServices = async (): Promise<
  Record<string, { status: HealthStatus; responseTime?: number; error?: string }>
> => {
  const services: Record<string, { status: HealthStatus; responseTime?: number; error?: string }> = {}

  // Add checks for external services if needed

  return services
}

// Health check handler
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  const start = Date.now()

  // Check core services
  const [dbHealth, redisHealth, kafkaHealth] = await Promise.all([checkDatabase(), checkRedis(), checkKafka()])

  // Check external services
  const externalServices = await checkExternalServices()

  // Determine overall status
  let overallStatus = HealthStatus.UP

  if (dbHealth.status === HealthStatus.DOWN || redisHealth.status === HealthStatus.DOWN) {
    overallStatus = HealthStatus.DOWN
  } else if (kafkaHealth.status === HealthStatus.DOWN) {
    overallStatus = HealthStatus.DEGRADED
  }

  // Check if any external service is down
  Object.values(externalServices).forEach((service) => {
    if (service.status === HealthStatus.DOWN && overallStatus === HealthStatus.UP) {
      overallStatus = HealthStatus.DEGRADED
    }
  })

  // Build health check result
  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
    services: {
      database: dbHealth,
      redis: redisHealth,
      kafka: kafkaHealth,
      ...externalServices,
    },
  }

  // Add response time
  const responseTime = Date.now() - start

  // Set status code based on health status
  const statusCode = overallStatus === HealthStatus.UP ? 200 : overallStatus === HealthStatus.DEGRADED ? 200 : 503

  // Set cache control header to prevent caching
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")

  // Send response
  res.status(statusCode).json({
    ...result,
    responseTime,
  })
}

// Readiness check handler
export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`

    // Check Redis connectivity if enabled
    if (config.redis.enabled) {
      const client = getRedisClient()
      await client.ping()
    }

    // Application is ready
    res.status(200).json({
      status: "READY",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Application is not ready
    logger.error("Readiness check failed:", error)
    res.status(503).json({
      status: "NOT_READY",
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
}

// Liveness check handler
export const livenessCheck = async (req: Request, res: Response): Promise<void> => {
  // This is a simple check to verify the application is running
  // It should not check external dependencies
  res.status(200).json({
    status: "ALIVE",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  })
}

// Deep health check handler (includes more detailed information)
export const deepHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const start = Date.now()

  // Check core services
  const [dbHealth, redisHealth, kafkaHealth] = await Promise.all([checkDatabase(), checkRedis(), checkKafka()])

  // Check external services
  const externalServices = await checkExternalServices()

  // Get system information
  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: process.uptime(),
    resourceUsage: process.resourceUsage(),
  }

  // Determine overall status
  let overallStatus = HealthStatus.UP

  if (dbHealth.status === HealthStatus.DOWN || redisHealth.status === HealthStatus.DOWN) {
    overallStatus = HealthStatus.DOWN
  } else if (kafkaHealth.status === HealthStatus.DOWN) {
    overallStatus = HealthStatus.DEGRADED
  }

  // Check if any external service is down
  Object.values(externalServices).forEach((service) => {
    if (service.status === HealthStatus.DOWN && overallStatus === HealthStatus.UP) {
      overallStatus = HealthStatus.DEGRADED
    }
  })

  // Build health check result
  const result = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      database: dbHealth,
      redis: redisHealth,
      kafka: kafkaHealth,
      ...externalServices,
    },
    system: systemInfo,
  }

  // Add response time
  const responseTime = Date.now() - start

  // Set status code based on health status
  const statusCode = overallStatus === HealthStatus.UP ? 200 : overallStatus === HealthStatus.DEGRADED ? 200 : 503

  // Set cache control header to prevent caching
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")

  // Send response
  res.status(statusCode).json({
    ...result,
    responseTime,
  })
}

export default {
  healthCheck,
  readinessCheck,
  livenessCheck,
  deepHealthCheck,
  HealthStatus,
}
