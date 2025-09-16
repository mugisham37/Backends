import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as vendorService from "../services/vendor.service"
import { translateError } from "../utils/translate"

/**
 * Create a new vendor
 * @route POST /api/v1/vendors
 * @access Protected (Admin)
 */
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Creating new vendor")

  const vendor = await vendorService.createVendor(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      vendor,
    },
  })
})

/**
 * Get vendor by ID
 * @route GET /api/v1/vendors/:id
 * @access Protected (Admin, Vendor)
 */
export const getVendorById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Getting vendor with ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  const vendor = await vendorService.getVendorById(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      vendor,
    },
  })
})

/**
 * Get vendor by slug
 * @route GET /api/v1/vendors/slug/:slug
 * @access Public
 */
export const getVendorBySlug = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { slug } = req.params

  requestLogger.info(`Getting vendor with slug: ${slug}`)

  if (!slug) {
    return next(new ApiError(translateError("vendorSlugRequired", {}, req.language), 400))
  }

  const vendor = await vendorService.getVendorBySlug(slug, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      vendor,
    },
  })
})

/**
 * Update vendor
 * @route PUT /api/v1/vendors/:id
 * @access Protected (Admin, Vendor)
 */
export const updateVendor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Updating vendor with ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  const vendor = await vendorService.updateVendor(id, req.body, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      vendor,
    },
  })
})

/**
 * Delete vendor
 * @route DELETE /api/v1/vendors/:id
 * @access Protected (Admin)
 */
export const deleteVendor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Deleting vendor with ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  const vendor = await vendorService.deleteVendor(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      vendor,
    },
  })
})

/**
 * Get all vendors
 * @route GET /api/v1/vendors
 * @access Protected (Admin)
 */
export const getAllVendors = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting all vendors")

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-createdAt"
  const select = req.query.select as string

  // Build filter
  const filter: Record<string, any> = {}

  if (req.query.status) {
    filter.status = req.query.status
  }

  if (req.query.active) {
    filter.active = req.query.active === "true"
  }

  if (req.query.search) {
    filter.$or = [
      { businessName: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ]
  }

  const { vendors, count } = await vendorService.getAllVendors(filter, { page, limit, sort, select }, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: vendors.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      vendors,
    },
  })
})

/**
 * Get vendor products
 * @route GET /api/v1/vendors/:id/products
 * @access Public
 */
export const getVendorProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Getting products for vendor ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-createdAt"

  // Build filter
  const filter: Record<string, any> = {}

  if (req.query.category) {
    filter.category = req.query.category
  }

  if (req.query.active) {
    filter.active = req.query.active === "true"
  }

  if (req.query.featured) {
    filter.featured = req.query.featured === "true"
  }

  if (req.query.minPrice && req.query.maxPrice) {
    filter.price = {
      $gte: Number.parseFloat(req.query.minPrice as string),
      $lte: Number.parseFloat(req.query.maxPrice as string),
    }
  } else if (req.query.minPrice) {
    filter.price = { $gte: Number.parseFloat(req.query.minPrice as string) }
  } else if (req.query.maxPrice) {
    filter.price = { $lte: Number.parseFloat(req.query.maxPrice as string) }
  }

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
    ]
  }

  const { products, count } = await vendorService.getVendorProducts(id, { page, limit, sort, filter }, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: products.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      products,
    },
  })
})

/**
 * Get vendor metrics
 * @route GET /api/v1/vendors/:id/metrics
 * @access Protected (Admin, Vendor)
 */
export const getVendorMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params
  const period = (req.query.period as "day" | "week" | "month" | "year" | "all") || "all"

  requestLogger.info(`Getting metrics for vendor ID: ${id} with period: ${period}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  const metrics = await vendorService.getVendorMetrics(id, period, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      metrics,
    },
  })
})

/**
 * Update vendor status
 * @route PATCH /api/v1/vendors/:id/status
 * @access Protected (Admin)
 */
export const updateVendorStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params
  const { status, notes } = req.body

  requestLogger.info(`Updating status for vendor ID: ${id} to ${status}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  if (!status) {
    return next(new ApiError(translateError("statusRequired", {}, req.language), 400))
  }

  const vendor = await vendorService.updateVendorStatus(id, status, notes, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      vendor,
    },
  })
})

/**
 * Get vendor payouts
 * @route GET /api/v1/vendors/:id/payouts
 * @access Protected (Admin, Vendor)
 */
export const getVendorPayouts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Getting payouts for vendor ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-createdAt"

  // Build filter
  const filter: Record<string, any> = {}

  if (req.query.status) {
    filter.status = req.query.status
  }

  if (req.query.startDate && req.query.endDate) {
    filter.createdAt = {
      $gte: new Date(req.query.startDate as string),
      $lte: new Date(req.query.endDate as string),
    }
  }

  const { payouts, count } = await vendorService.getVendorPayouts(id, { page, limit, sort, filter }, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: payouts.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      payouts,
    },
  })
})

/**
 * Calculate vendor payout
 * @route POST /api/v1/vendors/:id/calculate-payout
 * @access Protected (Admin)
 */
export const calculateVendorPayout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params
  const { startDate, endDate } = req.body

  requestLogger.info(`Calculating payout for vendor ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("vendorIdRequired", {}, req.language), 400))
  }

  if (!startDate || !endDate) {
    return next(new ApiError(translateError("dateRangeRequired", {}, req.language), 400))
  }

  const payoutCalculation = await vendorService.calculateVendorPayout(
    id,
    new Date(startDate),
    new Date(endDate),
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      payoutCalculation,
    },
  })
})

/**
 * Create vendor payout
 * @route POST /api/v1/vendors/payouts
 * @access Protected (Admin)
 */
export const createVendorPayout = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info(`Creating payout for vendor ID: ${req.body.vendor}`)

  const payout = await vendorService.createVendorPayout(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      payout,
    },
  })
})

/**
 * Update payout status
 * @route PATCH /api/v1/vendors/payouts/:id/status
 * @access Protected (Admin)
 */
export const updatePayoutStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params
  const { status, transactionId, notes } = req.body

  requestLogger.info(`Updating status for payout ID: ${id} to ${status}`)

  if (!id) {
    return next(new ApiError(translateError("payoutIdRequired", {}, req.language), 400))
  }

  if (!status) {
    return next(new ApiError(translateError("statusRequired", {}, req.language), 400))
  }

  const payout = await vendorService.updatePayoutStatus(id, status, transactionId, notes, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      payout,
    },
  })
})

/**
 * Get payout by ID
 * @route GET /api/v1/vendors/payouts/:id
 * @access Protected (Admin, Vendor)
 */
export const getPayoutById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Getting payout with ID: ${id}`)

  if (!id) {
    return next(new ApiError(translateError("payoutIdRequired", {}, req.language), 400))
  }

  const payout = await vendorService.getPayoutById(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      payout,
    },
  })
})
