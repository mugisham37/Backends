import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as recommendationService from "../services/recommendation.service"
import { translateError } from "../utils/translate"

/**
 * Get popular products
 * @route GET /api/v1/recommendations/popular
 * @access Public
 */
export const getPopularProducts = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting popular products")

  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10

  const products = await recommendationService.getPopularProducts(limit, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: products.length,
    data: {
      products,
    },
  })
})

/**
 * Get related products
 * @route GET /api/v1/recommendations/related/:productId
 * @access Public
 */
export const getRelatedProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { productId } = req.params
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10

  requestLogger.info(`Getting related products for product ID: ${productId}`)

  if (!productId) {
    return next(new ApiError(translateError("productIdRequired", {}, req.language), 400))
  }

  const products = await recommendationService.getRelatedProducts(productId, limit, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: products.length,
    data: {
      products,
    },
  })
})

/**
 * Get personalized recommendations
 * @route GET /api/v1/recommendations/personalized
 * @access Protected
 */
export const getPersonalizedRecommendations = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10

  requestLogger.info(`Getting personalized recommendations for user ID: ${userId}`)

  const products = await recommendationService.getPersonalizedRecommendations(userId, limit, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: products.length,
    data: {
      products,
    },
  })
})

/**
 * Track recently viewed product
 * @route POST /api/v1/recommendations/track-view/:productId
 * @access Protected
 */
export const trackRecentlyViewedProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const { productId } = req.params

  requestLogger.info(`Tracking recently viewed product for user ID: ${userId}, product ID: ${productId}`)

  if (!productId) {
    return next(new ApiError(translateError("productIdRequired", {}, req.language), 400))
  }

  await recommendationService.trackRecentlyViewedProduct(userId, productId, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    message: "Product view tracked successfully",
  })
})

/**
 * Get recently viewed products
 * @route GET /api/v1/recommendations/recently-viewed
 * @access Protected
 */
export const getRecentlyViewedProducts = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10

  requestLogger.info(`Getting recently viewed products for user ID: ${userId}`)

  const products = await recommendationService.getRecentlyViewedProducts(userId, limit, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: products.length,
    data: {
      products,
    },
  })
})

/**
 * Get frequently bought together products
 * @route GET /api/v1/recommendations/frequently-bought-together/:productId
 * @access Public
 */
export const getFrequentlyBoughtTogether = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { productId } = req.params
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 3

  requestLogger.info(`Getting frequently bought together products for product ID: ${productId}`)

  if (!productId) {
    return next(new ApiError(translateError("productIdRequired", {}, req.language), 400))
  }

  const products = await recommendationService.getFrequentlyBoughtTogether(productId, limit, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: products.length,
    data: {
      products,
    },
  })
})
