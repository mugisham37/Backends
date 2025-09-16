import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as countryService from "../services/country.service"
import { translateError } from "../utils/translate"

/**
 * Get all countries
 * @route GET /api/v1/countries
 * @access Public
 */
export const getAllCountries = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting all countries")

  const countries = await countryService.getAllCountries(req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: countries.length,
    data: {
      countries,
    },
  })
})

/**
 * Get country by code
 * @route GET /api/v1/countries/:code
 * @access Public
 */
export const getCountryByCode = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Getting country by code: ${code}`)

  if (!code) {
    return next(new ApiError(translateError("countryCodeRequired", {}, req.language), 400))
  }

  const country = await countryService.getCountryByCode(code, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      country,
    },
  })
})

/**
 * Create country
 * @route POST /api/v1/countries
 * @access Protected (Admin)
 */
export const createCountry = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info(`Creating country: ${JSON.stringify(req.body)}`)

  const country = await countryService.createCountry(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      country,
    },
  })
})

/**
 * Update country
 * @route PUT /api/v1/countries/:code
 * @access Protected (Admin)
 */
export const updateCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Updating country ${code}: ${JSON.stringify(req.body)}`)

  if (!code) {
    return next(new ApiError(translateError("countryCodeRequired", {}, req.language), 400))
  }

  const country = await countryService.updateCountry(code, req.body, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      country,
    },
  })
})

/**
 * Delete country
 * @route DELETE /api/v1/countries/:code
 * @access Protected (Admin)
 */
export const deleteCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Deleting country: ${code}`)

  if (!code) {
    return next(new ApiError(translateError("countryCodeRequired", {}, req.language), 400))
  }

  const country = await countryService.deleteCountry(code, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      country,
    },
  })
})

/**
 * Get states/provinces for a country
 * @route GET /api/v1/countries/:code/states
 * @access Public
 */
export const getStatesByCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Getting states for country: ${code}`)

  if (!code) {
    return next(new ApiError(translateError("countryCodeRequired", {}, req.language), 400))
  }

  const states = await countryService.getStatesByCountry(code, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: states.length,
    data: {
      states,
    },
  })
})
