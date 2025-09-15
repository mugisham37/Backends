import type { Request, Response, NextFunction } from "express"
import { analyticsService } from "../services/analytics.service"

export class AnalyticsController {
  /**
   * Get system overview
   */
  public getSystemOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overview = await analyticsService.getSystemOverview()

      res.status(200).json({
        status: "success",
        data: overview,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get content statistics
   */
  public getContentStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await analyticsService.getContentStats()

      res.status(200).json({
        status: "success",
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get media statistics
   */
  public getMediaStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await analyticsService.getMediaStats()

      res.status(200).json({
        status: "success",
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user statistics
   */
  public getUserStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await analyticsService.getUserStats()

      res.status(200).json({
        status: "success",
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get webhook statistics
   */
  public getWebhookStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await analyticsService.getWebhookStats()

      res.status(200).json({
        status: "success",
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflow statistics
   */
  public getWorkflowStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await analyticsService.getWorkflowStats()

      res.status(200).json({
        status: "success",
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get content creation over time
   */
  public getContentCreationOverTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as "day" | "week" | "month") || "day"
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 30

      const data = await analyticsService.getContentCreationOverTime(period, limit)

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user activity over time
   */
  public getUserActivityOverTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as "day" | "week" | "month") || "day"
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 30

      const data = await analyticsService.getUserActivityOverTime(period, limit)

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get content status distribution
   */
  public getContentStatusDistribution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await analyticsService.getContentStatusDistribution()

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get media type distribution
   */
  public getMediaTypeDistribution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await analyticsService.getMediaTypeDistribution()

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user role distribution
   */
  public getUserRoleDistribution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await analyticsService.getUserRoleDistribution()

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get top content creators
   */
  public getTopContentCreators = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10

      const data = await analyticsService.getTopContentCreators(limit)

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get webhook success rate over time
   */
  public getWebhookSuccessRateOverTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as "day" | "week" | "month") || "day"
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 30

      const data = await analyticsService.getWebhookSuccessRateOverTime(period, limit)

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflow completion statistics
   */
  public getWorkflowCompletionStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await analyticsService.getWorkflowCompletionStats()

      res.status(200).json({
        status: "success",
        data,
      })
    } catch (error) {
      next(error)
    }
  }
}
