import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as analyticsService from "../services/analytics.service"
import mongoose from "mongoose"

/**
 * Get dashboard analytics
 * @route GET /api/v1/analytics/dashboard
 * @access Protected (Admin)
 */
export const getDashboardAnalytics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting dashboard analytics")

  // Parse query parameters
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const compareWithPrevious = req.query.compareWithPrevious !== "false"

  // Validate dates
  if (startDate && isNaN(startDate.getTime())) {
    return next(new ApiError("Invalid start date", 400))
  }

  if (endDate && isNaN(endDate.getTime())) {
    return next(new ApiError("Invalid end date", 400))
  }

  // Get dashboard analytics
  const analytics = await analyticsService.getDashboardAnalytics(
    {
      startDate,
      endDate,
      compareWithPrevious,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: analytics,
  })
})

/**
 * Get sales analytics
 * @route GET /api/v1/analytics/sales
 * @access Protected (Admin)
 */
export const getSalesAnalytics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting sales analytics")

  // Parse query parameters
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const interval = req.query.interval as "hourly" | "daily" | "weekly" | "monthly" | undefined
  const compareWithPrevious = req.query.compareWithPrevious !== "false"
  const groupBy = req.query.groupBy as
    | "product"
    | "category"
    | "vendor"
    | "customer"
    | "paymentMethod"
    | "country"
    | undefined

  // Validate dates
  if (startDate && isNaN(startDate.getTime())) {
    return next(new ApiError("Invalid start date", 400))
  }

  if (endDate && isNaN(endDate.getTime())) {
    return next(new ApiError("Invalid end date", 400))
  }

  // Validate interval
  if (interval && !["hourly", "daily", "weekly", "monthly"].includes(interval)) {
    return next(new ApiError("Invalid interval. Must be one of: hourly, daily, weekly, monthly", 400))
  }

  // Validate groupBy
  if (groupBy && !["product", "category", "vendor", "customer", "paymentMethod", "country"].includes(groupBy)) {
    return next(
      new ApiError("Invalid groupBy. Must be one of: product, category, vendor, customer, paymentMethod, country", 400),
    )
  }

  // Get sales analytics
  const analytics = await analyticsService.getSalesAnalytics(
    {
      startDate,
      endDate,
      interval,
      compareWithPrevious,
      groupBy,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: analytics,
  })
})

/**
 * Get customer analytics
 * @route GET /api/v1/analytics/customers
 * @access Protected (Admin)
 */
export const getCustomerAnalytics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting customer analytics")

  // Parse query parameters
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const segment = req.query.segment as "new" | "returning" | "inactive" | "all" | undefined

  // Validate dates
  if (startDate && isNaN(startDate.getTime())) {
    return next(new ApiError("Invalid start date", 400))
  }

  if (endDate && isNaN(endDate.getTime())) {
    return next(new ApiError("Invalid end date", 400))
  }

  // Validate segment
  if (segment && !["new", "returning", "inactive", "all"].includes(segment)) {
    return next(new ApiError("Invalid segment. Must be one of: new, returning, inactive, all", 400))
  }

  // Get customer analytics
  const analytics = await analyticsService.getCustomerAnalytics(
    {
      startDate,
      endDate,
      segment,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: analytics,
  })
})

/**
 * Get inventory analytics
 * @route GET /api/v1/analytics/inventory
 * @access Protected (Admin)
 */
export const getInventoryAnalytics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting inventory analytics")

  // Parse query parameters
  const categoryId = req.query.categoryId as string | undefined
  const vendorId = req.query.vendorId as string | undefined
  const lowStockThreshold = req.query.lowStockThreshold ? Number(req.query.lowStockThreshold) : undefined

  // Validate IDs
  if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
    return next(new ApiError("Invalid category ID", 400))
  }

  if (vendorId && !mongoose.Types.ObjectId.isValid(vendorId)) {
    return next(new ApiError("Invalid vendor ID", 400))
  }

  // Validate threshold
  if (lowStockThreshold !== undefined && (isNaN(lowStockThreshold) || lowStockThreshold < 0)) {
    return next(new ApiError("Invalid low stock threshold. Must be a non-negative number", 400))
  }

  // Get inventory analytics
  const analytics = await analyticsService.getInventoryAnalytics(
    {
      categoryId,
      vendorId,
      lowStockThreshold,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: analytics,
  })
})
