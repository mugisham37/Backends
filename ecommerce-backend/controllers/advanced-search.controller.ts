import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as advancedSearchService from "../services/advanced-search.service"

/**
 * Advanced search with faceted navigation
 * @route GET /api/v1/search/advanced
 * @access Public
 */
export const advancedSearch = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Performing advanced search")

  // Parse query parameters
  const query = req.query.q as string | undefined
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = req.query.sort as string | undefined
  const includeFacets = req.query.includeFacets !== "false"

  // Extract filters from query parameters
  const filters: Record<string, any> = {}

  // Category filter
  if (req.query.category) {
    filters.category = req.query.category
  }

  // Vendor filter
  if (req.query.vendor) {
    filters.vendor = req.query.vendor
  }

  // Price filter
  if (req.query.minPrice) {
    filters.minPrice = req.query.minPrice
  }

  if (req.query.maxPrice) {
    filters.maxPrice = req.query.maxPrice
  }

  // Rating filter
  if (req.query.rating) {
    filters.rating = req.query.rating
  }

  // Stock filter
  if (req.query.inStock) {
    filters.inStock = req.query.inStock
  }

  // Featured filter
  if (req.query.featured) {
    filters.featured = req.query.featured
  }

  // Attributes filter
  if (req.query.attributes) {
    filters.attributes = req.query.attributes
  }

  // Tags filter
  if (req.query.tags) {
    filters.tags = req.query.tags
  }

  // Discount filter
  if (req.query.onSale) {
    filters.onSale = req.query.onSale
  }

  // Date filter
  if (req.query.createdAfter) {
    filters.createdAfter = req.query.createdAfter
  }

  if (req.query.createdBefore) {
    filters.createdBefore = req.query.createdBefore
  }

  // Validate pagination
  if (page < 1) {
    return next(new ApiError("Page must be greater than or equal to 1", 400))
  }

  if (limit < 1 || limit > 100) {
    return next(new ApiError("Limit must be between 1 and 100", 400))
  }

  // Perform search
  const searchResults = await advancedSearchService.advancedSearch(
    {
      query,
      filters,
      page,
      limit,
      sort,
      includeFacets,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: searchResults,
  })
})

/**
 * Get product suggestions for autocomplete
 * @route GET /api/v1/search/suggestions
 * @access Public
 */
export const getProductSuggestions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting product suggestions")

  // Parse query parameters
  const query = req.query.q as string | undefined
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 5
  const includeCategories = req.query.includeCategories !== "false"
  const includeVendors = req.query.includeVendors !== "false"

  if (!query) {
    return next(new ApiError("Query parameter 'q' is required", 400))
  }

  // Validate limit
  if (limit < 1 || limit > 20) {
    return next(new ApiError("Limit must be between 1 and 20", 400))
  }

  // Get suggestions
  const suggestions = await advancedSearchService.getProductSuggestions(
    query,
    {
      limit,
      includeCategories,
      includeVendors,
    },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: suggestions,
  })
})

/**
 * Get popular searches
 * @route GET /api/v1/search/popular
 * @access Public
 */
export const getPopularSearches = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting popular searches")

  // Parse query parameters
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10

  // Validate limit
  if (limit < 1 || limit > 50) {
    return next(new ApiError("Limit must be between 1 and 50", 400))
  }

  // Get popular searches
  const popularSearches = await advancedSearchService.getPopularSearches(limit, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: popularSearches,
  })
})
