import type { Request, Response } from "express"
import asyncHandler from "express-async-handler"
import * as loyaltyService from "../services/loyalty.service"
import { createRequestLogger } from "../config/logger"

/**
 * Get customer loyalty dashboard
 * @route GET /api/v1/loyalty/dashboard
 * @access Private
 */
export const getCustomerLoyaltyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting customer loyalty dashboard")

  const userId = req.user._id.toString()
  const dashboard = await loyaltyService.getCustomerLoyaltyDashboard(userId, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: dashboard,
  })
})

/**
 * Get loyalty statistics by period
 * @route GET /api/v1/loyalty/statistics/:period
 * @access Private
 */
export const getLoyaltyStatisticsByPeriod = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { period } = req.params
  requestLogger.info(`Getting loyalty statistics for period: ${period}`)

  // Validate period
  if (!["week", "month", "year", "all"].includes(period)) {
    return res.status(400).json({
      status: "error",
      requestId: req.id,
      message: "Invalid period. Must be one of: week, month, year, all",
    })
  }

  const userId = req.user._id.toString()
  const statistics = await loyaltyService.getLoyaltyStatisticsByPeriod(
    userId,
    period as "week" | "month" | "year" | "all",
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: statistics,
  })
})
