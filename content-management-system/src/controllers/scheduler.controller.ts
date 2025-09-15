import type { Request, Response, NextFunction } from "express"
import { schedulerService, type JobStatus } from "../services/scheduler.service"
import { ApiError } from "../utils/errors"

export class SchedulerController {
  /**
   * Create a new job
   */
  public createJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type, cronExpression, data, scheduledFor, maxRuns, maxRetries, priority, tags, runImmediately } =
        req.body

      // Create job
      const job = await schedulerService.createJob({
        name,
        type,
        cronExpression,
        data,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        maxRuns,
        maxRetries,
        priority,
        tags,
        runImmediately,
      })

      res.status(201).json({
        status: "success",
        data: {
          job,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get a job by ID
   */
  public getJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const job = await schedulerService.getJob(id)
      if (!job) {
        throw ApiError.notFound("Job not found")
      }

      res.status(200).json({
        status: "success",
        data: {
          job,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get jobs with filtering and pagination
   */
  public getJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, name, type, tags, page = 1, limit = 20, sort = "createdAt", order = "desc" } = req.query as any

      // Parse status
      let parsedStatus: JobStatus[] | undefined
      if (status) {
        parsedStatus = Array.isArray(status) ? status : [status]
      }

      // Parse tags
      let parsedTags: string[] | undefined
      if (tags) {
        parsedTags = Array.isArray(tags) ? tags : [tags]
      }

      const result = await schedulerService.getJobs({
        status: parsedStatus,
        name,
        type,
        tags: parsedTags,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort,
        order,
      })

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Cancel a job
   */
  public cancelJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const job = await schedulerService.cancelJob(id)
      if (!job) {
        throw ApiError.notFound("Job not found")
      }

      res.status(200).json({
        status: "success",
        data: {
          job,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Retry a failed job
   */
  public retryJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const job = await schedulerService.retryJob(id)
      if (!job) {
        throw ApiError.notFound("Job not found")
      }

      res.status(200).json({
        status: "success",
        data: {
          job,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete a job
   */
  public deleteJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const deleted = await schedulerService.deleteJob(id)
      if (!deleted) {
        throw ApiError.notFound("Job not found")
      }

      res.status(200).json({
        status: "success",
        message: "Job deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clean up old jobs
   */
  public cleanupJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { olderThan, status, keepLastN } = req.body

      // Parse olderThan
      let parsedOlderThan: Date | undefined
      if (olderThan) {
        parsedOlderThan = new Date(olderThan)
      }

      // Parse status
      let parsedStatus: JobStatus[] | undefined
      if (status) {
        parsedStatus = Array.isArray(status) ? status : [status]
      }

      // Parse keepLastN
      let parsedKeepLastN: number | undefined
      if (keepLastN) {
        parsedKeepLastN = Number.parseInt(keepLastN)
      }

      const deletedCount = await schedulerService.cleanupJobs({
        olderThan: parsedOlderThan,
        status: parsedStatus,
        keepLastN: parsedKeepLastN,
      })

      res.status(200).json({
        status: "success",
        data: {
          deletedCount,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
