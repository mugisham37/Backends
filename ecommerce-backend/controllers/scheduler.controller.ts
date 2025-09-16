import type { Request, Response } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as schedulerService from "../services/scheduler.service"

/**
 * Get job status
 * @route GET /api/v1/admin/scheduler/status
 * @access Protected (Admin)
 */
export const getJobStatus = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting scheduler job status")

  const status = schedulerService.getJobStatus()

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      jobs: status,
    },
  })
})

/**
 * Start a job
 * @route POST /api/v1/admin/scheduler/start/:jobName
 * @access Protected (Admin)
 */
export const startJob = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { jobName } = req.params

  requestLogger.info(`Starting scheduler job: ${jobName}`)

  const result = schedulerService.startJob(jobName)

  if (!result) {
    throw new ApiError(`Failed to start job: ${jobName}`, 400)
  }

  res.status(200).json({
    status: "success",
    requestId: req.id,
    message: `Job ${jobName} started successfully`,
  })
})

/**
 * Stop a job
 * @route POST /api/v1/admin/scheduler/stop/:jobName
 * @access Protected (Admin)
 */
export const stopJob = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { jobName } = req.params

  requestLogger.info(`Stopping scheduler job: ${jobName}`)

  const result = schedulerService.stopJob(jobName)

  if (!result) {
    throw new ApiError(`Failed to stop job: ${jobName}`, 400)
  }

  res.status(200).json({
    status: "success",
    requestId: req.id,
    message: `Job ${jobName} stopped successfully`,
  })
})

/**
 * Run a job now
 * @route POST /api/v1/admin/scheduler/run/:jobName
 * @access Protected (Admin)
 */
export const runJobNow = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { jobName } = req.params

  requestLogger.info(`Running scheduler job now: ${jobName}`)

  const result = await schedulerService.runJobNow(jobName)

  if (!result) {
    throw new ApiError(`Failed to run job: ${jobName}`, 400)
  }

  res.status(200).json({
    status: "success",
    requestId: req.id,
    message: `Job ${jobName} executed successfully`,
  })
})

/**
 * Start all jobs
 * @route POST /api/v1/admin/scheduler/start-all
 * @access Protected (Admin)
 */
export const startAllJobs = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Starting all scheduler jobs")

  schedulerService.startAllJobs()

  res.status(200).json({
    status: "success",
    requestId: req.id,
    message: "All jobs started successfully",
  })
})

/**
 * Stop all jobs
 * @route POST /api/v1/admin/scheduler/stop-all
 * @access Protected (Admin)
 */
export const stopAllJobs = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Stopping all scheduler jobs")

  schedulerService.stopAllJobs()

  res.status(200).json({
    status: "success",
    requestId: req.id,
    message: "All jobs stopped successfully",
  })
})
