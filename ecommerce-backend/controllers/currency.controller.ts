import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as currencyService from "../services/currency.service"
import { translateError } from "../utils/translate"

/**
 * Get all currencies
 * @route GET /api/v1/currencies
 * @access Public
 */
export const getAllCurrencies = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting all currencies")

  const currencies = await currencyService.getAllCurrencies(req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: currencies.length,
    data: {
      currencies,
    },
  })
})

/**
 * Get currency by code
 * @route GET /api/v1/currencies/:code
 * @access Public
 */
export const getCurrencyByCode = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Getting currency by code: ${code}`)

  if (!code) {
    return next(new ApiError(translateError("currencyCodeRequired", {}, req.language), 400))
  }

  const currency = await currencyService.getCurrencyByCode(code, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      currency,
    },
  })
})

/**
 * Get base currency
 * @route GET /api/v1/currencies/base
 * @access Public
 */
export const getBaseCurrency = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting base currency")

  const currency = await currencyService.getBaseCurrency(req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      currency,
    },
  })
})

/**
 * Create currency
 * @route POST /api/v1/currencies
 * @access Protected (Admin)
 */
export const createCurrency = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info(`Creating currency: ${JSON.stringify(req.body)}`)

  const currency = await currencyService.createCurrency(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      currency,
    },
  })
})

/**
 * Update currency
 * @route PUT /api/v1/currencies/:code
 * @access Protected (Admin)
 */
export const updateCurrency = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Updating currency ${code}: ${JSON.stringify(req.body)}`)

  if (!code) {
    return next(new ApiError(translateError("currencyCodeRequired", {}, req.language), 400))
  }

  const currency = await currencyService.updateCurrency(code, req.body, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      currency,
    },
  })
})

/**
 * Delete currency
 * @route DELETE /api/v1/currencies/:code
 * @access Protected (Admin)
 */
export const deleteCurrency = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Deleting currency: ${code}`)

  if (!code) {
    return next(new ApiError(translateError("currencyCodeRequired", {}, req.language), 400))
  }

  const currency = await currencyService.deleteCurrency(code, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      currency,
    },
  })
})

/**
 * Set base currency
 * @route POST /api/v1/currencies/:code/set-base
 * @access Protected (Admin)
 */
export const setBaseCurrency = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { code } = req.params

  requestLogger.info(`Setting base currency: ${code}`)

  if (!code) {
    return next(new ApiError(translateError("currencyCodeRequired", {}, req.language), 400))
  }

  const currency = await currencyService.setBaseCurrency(code, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      currency,
    },
  })
})

/**
 * Update exchange rates
 * @route POST /api/v1/currencies/update-rates
 * @access Protected (Admin)
 */
export const updateExchangeRates = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Updating exchange rates")

  const { apiKey } = req.body

  if (!apiKey) {
    return next(new ApiError(translateError("apiKeyRequired", {}, req.language), 400))
  }

  const currencies = await currencyService.updateExchangeRates(apiKey, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: currencies.length,
    data: {
      currencies,
    },
  })
})

/**
 * Convert currency
 * @route GET /api/v1/currencies/convert
 * @access Public
 */
export const convertCurrency = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { amount, from, to } = req.query

  requestLogger.info(`Converting ${amount} from ${from} to ${to}`)

  if (!amount || !from || !to) {
    return next(new ApiError(translateError("conversionParamsRequired", {}, req.language), 400))
  }

  const numericAmount = Number(amount)

  if (isNaN(numericAmount)) {
    return next(new ApiError(translateError("invalidAmount", {}, req.language), 400))
  }

  const convertedAmount = await currencyService.convertCurrency(numericAmount, from as string, to as string, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      amount: numericAmount,
      fromCurrency: from,
      toCurrency: to,
      convertedAmount,
    },
  })
})

/**
 * Format currency
 * @route GET /api/v1/currencies/format
 * @access Public
 */
export const formatCurrency = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { amount, currency } = req.query

  requestLogger.info(`Formatting ${amount} in ${currency}`)

  if (!amount || !currency) {
    return next(new ApiError(translateError("formatParamsRequired", {}, req.language), 400))
  }

  const numericAmount = Number(amount)

  if (isNaN(numericAmount)) {
    return next(new ApiError(translateError("invalidAmount", {}, req.language), 400))
  }

  const formattedAmount = await currencyService.formatCurrency(numericAmount, currency as string, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      amount: numericAmount,
      currency,
      formattedAmount,
    },
  })
})
