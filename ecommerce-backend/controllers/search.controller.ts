import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { createRequestLogger } from "../config/logger";
import * as searchService from "../services/search.service";

/**
 * Search products with faceted navigation
 * @route GET /api/v1/search
 * @access Public
 */
export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  const query = (req.query.q as string) || "";

  requestLogger.info(`Searching products with query: ${query}`);

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10;
  const sort = (req.query.sort as string) || "relevance";

  // Build filter
  const filter: Record<string, any> = {};

  if (req.query.category) {
    filter.category = req.query.category;
  }

  if (req.query.vendor) {
    filter.vendor = req.query.vendor;
  }

  if (req.query.minPrice || req.query.maxPrice) {
    filter.minPrice = req.query.minPrice;
    filter.maxPrice = req.query.maxPrice;
  }

  if (req.query.rating) {
    filter.rating = req.query.rating;
  }

  if (req.query.inStock) {
    filter.inStock = req.query.inStock;
  }

  if (req.query.featured) {
    filter.featured = req.query.featured;
  }

  if (req.query.attributes) {
    filter.attributes = req.query.attributes;
  }

  if (req.query.tags) {
    filter.tags = req.query.tags;
  }

  const { products, count, facets } = await searchService.searchProducts(
    query,
    filter,
    { page, limit, sort },
    req.id
  );

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
      facets,
    },
  });
});

/**
 * Get product suggestions for autocomplete
 * @route GET /api/v1/search/suggestions
 * @access Public
 */
export const getProductSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  const query = (req.query.q as string) || "";
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 5;

  requestLogger.info(`Getting product suggestions for query: ${query}`);

  const suggestions = await searchService.getProductSuggestions(query, limit, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: suggestions.length,
    data: {
      suggestions,
    },
  });
});
