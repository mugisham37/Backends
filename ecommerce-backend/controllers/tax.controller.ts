import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as taxService from "../services/tax.service"
import { translateError } from "../utils/translate"
import mongoose from "mongoose"

/**
 * Get all tax rates
 * @route GET /api/v1/taxes
 * @access Public
 */
export const getAllTaxRates = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting all tax rates")

  const taxRates = await taxService.getAllTaxRates(req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: taxRates.length,
    data: {
      taxRates,
    },
  })
})

/**
 * Get tax rate by ID
 * @route GET /api/v1/taxes/:id
 * @access Public
 */
export const getTaxRateById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Getting tax rate by ID: ${id}`)

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError(translateError("invalidTaxRateId", {}, req.language), 400))
  }

  const taxRate = await taxService.getTaxRateById(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      taxRate,
    },
  })
})

/**
 * Create tax rate
 * @route POST /api/v1/taxes
 * @access Protected (Admin)
 */
export const createTaxRate = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info(`Creating tax rate: ${JSON.stringify(req.body)}`)

  const taxRate = await taxService.createTaxRate(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      taxRate,
    },
  })
})

/**
 * Update tax rate
 * @route PUT /api/v1/taxes/:id
 * @access Protected (Admin)
 */
export const updateTaxRate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Updating tax rate ${id}: ${JSON.stringify(req.body)}`)

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError(translateError("invalidTaxRateId", {}, req.language), 400))
  }

  const taxRate = await taxService.updateTaxRate(id, req.body, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      taxRate,
    },
  })
})

/**
 * Delete tax rate
 * @route DELETE /api/v1/taxes/:id
 * @access Protected (Admin)
 */
export const deleteTaxRate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  requestLogger.info(`Deleting tax rate: ${id}`)

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError(translateError("invalidTaxRateId", {}, req.language), 400))
  }

  const taxRate = await taxService.deleteTaxRate(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      taxRate,
    },
  })
})

/**
 * Get applicable tax rate
 * @route GET /api/v1/taxes/applicable
 * @access Public
 */
export const getApplicableTaxRate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { country, state, postalCode, categoryId } = req.query

  requestLogger.info(
    `Getting applicable tax rate for ${country}, ${state || "any"}, ${postalCode || "any"}, category: ${
      categoryId || "any"
    }`,
  )

  if (!country) {
    return next(new ApiError(translateError("countryRequired", {}, req.language), 400))
  }

  const taxRate = await taxService.getApplicableTaxRate(
    country as string,
    state as string,
    postalCode as string,
    categoryId as string,
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      taxRate,
    },
  })
})

/**
 * Calculate tax
 * @route GET /api/v1/taxes/calculate
 * @access Public
 */
export const calculateTax = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { amount, country, state, postalCode, categoryId } = req.query

  requestLogger.info(
    `Calculating tax for amount ${amount} in ${country}, ${state || "any"}, ${postalCode || "any"}, category: ${
      categoryId || "any"
    }`,
  )

  if (!amount || !country) {
    return next(new ApiError(translateError("taxCalculationParamsRequired", {}, req.language), 400))
  }

  const numericAmount = Number(amount)

  if (isNaN(numericAmount)) {
    return next(new ApiError(translateError("invalidAmount", {}, req.language), 400))
  }

  const taxDetails = await taxService.calculateTax(
    numericAmount,
    country as string,
    state as string,
    postalCode as string,
    categoryId as string,
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      amount: numericAmount,
      ...taxDetails,
      totalAmount: numericAmount + taxDetails.taxAmount,
    },
  })
})
