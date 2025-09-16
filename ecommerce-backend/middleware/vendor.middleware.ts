import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import Vendor from "../models/vendor.model"
import { createRequestLogger } from "../config/logger"

/**
 * Check if user is a vendor
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const isVendor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id

  requestLogger.info(`Checking if user ${userId} is a vendor`)

  // Find vendor by user ID
  const vendor = await Vendor.findOne({ user: userId })

  if (!vendor) {
    return next(new ApiError("You are not authorized as a vendor", 403))
  }

  // Check if vendor is approved
  if (vendor.status !== "approved") {
    return next(new ApiError(`Your vendor account is ${vendor.status}. Please contact support.`, 403))
  }

  // Add vendor to request
  req.vendor = vendor

  next()
})

/**
 * Check if user is the owner of the vendor
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const isVendorOwner = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const { vendorId } = req.params

  requestLogger.info(`Checking if user ${userId} is the owner of vendor ${vendorId}`)

  // Find vendor by ID
  const vendor = await Vendor.findById(vendorId)

  if (!vendor) {
    return next(new ApiError("Vendor not found", 404))
  }

  // Check if user is the owner
  if (vendor.user.toString() !== userId.toString()) {
    return next(new ApiError("You are not authorized to access this vendor", 403))
  }

  // Add vendor to request
  req.vendor = vendor

  next()
})
