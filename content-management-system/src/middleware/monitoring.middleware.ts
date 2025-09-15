import type { Request, Response, NextFunction } from "express"
import { monitoringService } from "../services/monitoring.service"
import { logger } from "../utils/logger"

/**
 * Middleware to track API metrics
 */
export const apiMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Record start time
  const startTime = Date.now()

  // Store original end function
  const originalEnd = res.end

  // Override end function to capture metrics
  res.end = function (this: Response, ...args: any[]) {
    // Calculate response time
    const responseTime = Date.now() - startTime

    // Record metrics
    monitoringService
      .recordApiMetrics({
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        userId: (req as any).user?.id,
      })
      .catch((error) => {
        logger.error("Error recording API metrics:", error)
      })

    // Call original end function
    return originalEnd.apply(this, args)
  }

  next()
}
