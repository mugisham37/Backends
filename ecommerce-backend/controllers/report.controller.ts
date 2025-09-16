import type { Request, Response } from "express"
import { asyncHandler } from "../utils/async-handler"
import { createRequestLogger } from "../config/logger"
import * as reportService from "../services/report.service"
import { ApiError } from "../utils/api-error"

/**
 * Generate loyalty report
 * @route POST /api/v1/admin/reports/loyalty
 * @access Protected (Admin)
 */
export const generateLoyaltyReport = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { format, type, startDate, endDate, filter } = req.body

  requestLogger.info(`Generating loyalty report of type: ${type} in format: ${format}`)

  // Validate required fields
  if (!format || !type) {
    throw new ApiError("Format and type are required", 400)
  }

  // Validate format
  if (!["csv", "excel", "pdf", "json"].includes(format)) {
    throw new ApiError("Invalid format. Must be one of: csv, excel, pdf, json", 400)
  }

  // Validate type
  if (!["points", "redemptions", "tiers", "referrals"].includes(type)) {
    throw new ApiError("Invalid type. Must be one of: points, redemptions, tiers, referrals", 400)
  }

  // Parse dates if provided
  const parsedStartDate = startDate ? new Date(startDate) : undefined
  const parsedEndDate = endDate ? new Date(endDate) : undefined

  // Generate report
  const reportPath = await reportService.generateLoyaltyReport(
    {
      format: format as "csv" | "excel" | "pdf" | "json",
      type: type as "points" | "redemptions" | "tiers" | "referrals",
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      filter,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      reportPath,
      downloadUrl: `/api/v1/export/download?path=${encodeURIComponent(reportPath)}`,
    },
  })
})
