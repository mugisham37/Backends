import type { Request, Response, NextFunction } from "express"
import { monitoringService } from "../services/monitoring.service"
import { logger } from "../utils/logger"
import { ApiError } from "../utils/errors"

export class MonitoringController {
  /**
   * Get system health status
   */
  public getHealthStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await monitoringService.getHealthStatus()
      res.status(200).json({
        status: "success",
        data: health,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get system metrics
   */
  public getMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user has admin role
      const user = (req as any).user
      if (!user || user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to access metrics")
      }

      const metrics = await monitoringService.getMetrics()
      res.status(200).json({
        status: "success",
        data: metrics,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get application metrics
   */
  public getApplicationMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user has admin role
      const user = (req as any).user
      if (!user || user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to access application metrics")
      }

      const metrics = await monitoringService.getApplicationMetrics()
      res.status(200).json({
        status: "success",
        data: metrics,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Simple health check endpoint
   */
  public healthCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isHealthy = await monitoringService.isHealthy()

      if (isHealthy) {
        res.status(200).json({
          status: "success",
          message: "Service is healthy",
        })
      } else {
        res.status(503).json({
          status: "error",
          message: "Service is unhealthy",
        })
      }
    } catch (error) {
      logger.error("Health check failed:", error)
      res.status(503).json({
        status: "error",
        message: "Health check failed",
      })
    }
  }
}
