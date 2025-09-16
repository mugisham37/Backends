import mongoose from "mongoose"
import Product from "../models/product.model"
import Category from "../models/category.model"
import { createRequestLogger } from "../config/logger"
import { getCache, setCache } from "../config/redis"
import { ApiError } from "../utils/api-error"

// Cache TTL in seconds
const CACHE_TTL = {
  SEARCH_RESULTS: 1800, // 30 minutes
  FACETS: 3600, // 1 hour
}

/**
 * Search products with faceted navigation
 * @param query Search query
 * @param filter Filter options
 * @param options Pagination and sorting options
 * @param requestId Request ID for logging
 * @returns Search results with facets
 */
export const searchProducts = async (
  query: string,
  filter: Record<string, any> = {},
  options: {
    page?: number
    limit?: number
    sort?: string
  } = {},
  requestId?: string,
): Promise<{
  products: any[]
  count: number
  facets: Record<string, any>
}> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Searching products with query: ${query}`)

  const { page = 1, limit = 10, sort = "relevance" } = options

  // Build search query
  const searchQuery: Record<string, any> = {
    active: true,
  }

  // Add text search if query is provided
  if (query && query.trim()) {
    searchQuery.$text = { $search: query }
  }

  // Add filters
  if (filter.category) {
    // Check if it's a category ID or slug
    if (mongoose.Types.ObjectId.isValid(filter.category)) {
      searchQuery.category = filter.category
    } else {
      // Find category by slug
      const category = await Category.findOne({ slug: filter.category })
      if (category) {
        searchQuery.category = category._id
      }
    }
  }

  if (filter.vendor) {
    searchQuery.vendor = filter.vendor
  }

  if (filter.minPrice !== undefined && filter.maxPrice !== undefined) {
    searchQuery.price = {
      $gte: Number(filter.minPrice),
      $lte: Number(filter.maxPrice),
    }
  } else if (filter.minPrice !== undefined) {
    searchQuery.price = { $gte: Number(filter.minPrice) }
  } else if (filter.maxPrice !== undefined) {
    searchQuery.price = { $lte: Number(filter.maxPrice) }
  }

  if (filter.rating) {
    searchQuery["ratings.average"] = { $gte: Number(filter.rating) }
  }

  if (filter.inStock !== undefined) {
    searchQuery.quantity = filter.inStock === "true" ? { $gt: 0 } : { $lte: 0 }
  }

  if (filter.featured !== undefined) {
    searchQuery.featured = filter.featured === "true"
  }

  // Handle attributes filter
  if (filter.attributes) {
    const attributeFilters = Array.isArray(filter.attributes) ? filter.attributes : [filter.attributes]

    const attributeQueries = attributeFilters.map((attr: string) => {
      const [name, value] = attr.split(":")
      return {
        attributes: {
          $elemMatch: {
            name,
            value,
          },
        },
      }
    })

    if (attributeQueries.length > 0) {
      searchQuery.$and = searchQuery.$and || []
      searchQuery.$and.push(...attributeQueries)
    }
  }

  // Handle tags filter
  if (filter.tags) {
    const tags = Array.isArray(filter.tags) ? filter.tags : [filter.tags]
    searchQuery.tags = { $in: tags }
  }

  // Try to get from cache
  const cacheKey = `search:${JSON.stringify({ query, filter, page, limit, sort })}`
  const cachedData = await getCache<{
    products: any[]
    count: number
    facets: Record<string, any>
  }>(cacheKey)

  if (cachedData) {
    logger.info(`Retrieved search results from cache`)
    return cachedData
  }

  try {
    // Determine sort order
    let sortOptions: Record<string, any> = {}

    if (sort === "relevance" && query && query.trim()) {
      sortOptions = { score: { $meta: "textScore" } }
    } else if (sort === "price_asc") {
      sortOptions = { price: 1 }
    } else if (sort === "price_desc") {
      sortOptions = { price: -1 }
    } else if (sort === "newest") {
      sortOptions = { createdAt: -1 }
    } else if (sort === "rating") {
      sortOptions = { "ratings.average": -1 }
    } else if (sort === "popularity") {
      sortOptions = { "ratings.count": -1 }
    } else {
      // Default sort
      sortOptions = { createdAt: -1 }
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit

    // Execute search query with projection
    const searchOptions: any = {
      skip,
      limit,
      sort: sortOptions,
    }

    // Add text score projection if using text search
    if (query && query.trim()) {
      searchOptions.projection = {
        score: { $meta: "textScore" },
      }
    }

    // Get products
    const products = await Product.find(searchQuery, searchOptions.projection)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("vendor", "businessName slug")
      .lean()

    // Get total count
    const count = await Product.countDocuments(searchQuery)

    // Get facets
    const facets = await getFacets(searchQuery, requestId)

    // Prepare result
    const result = {
      products,
      count,
      facets,
    }

    // Cache the results
    await setCache(cacheKey, result, CACHE_TTL.SEARCH_RESULTS)

    return result
  } catch (error: any) {
    logger.error(`Error searching products: ${error.message}`)
    throw new ApiError(`Failed to search products: ${error.message}`, 500)
  }
}

/**
 * Get facets for search results
 * @param baseQuery Base query for facets
 * @param requestId Request ID for logging
 * @returns Facets for search results
 */
export const getFacets = async (baseQuery: Record<string, any>, requestId?: string): Promise<Record<string, any>> => {
  const logger = createRequestLogger(requestId)
  logger.info("Getting facets for search results")

  // Try to get from cache
  const cacheKey = `facets:${JSON.stringify(baseQuery)}`
  const cachedFacets = await getCache<Record<string, any>>(cacheKey)

  if (cachedFacets) {
    logger.info(`Retrieved facets from cache`)
    return cachedFacets
  }

  try {
    // Get price range
    const priceRange = await Product.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          min: { $min: "$price" },
          max: { $max: "$price" },
        },
      },
    ])

    // Get categories
    const categories = await Product.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: "$category._id",
          name: "$category.name",
          slug: "$category.slug",
          count: 1,
        },
      },
    ])

    // Get vendors
    const vendors = await Product.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$vendor",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendor",
        },
      },
      { $unwind: "$vendor" },
      {
        $project: {
          _id: "$vendor._id",
          name: "$vendor.businessName",
          slug: "$vendor.slug",
          count: 1,
        },
      },
    ])

    // Get ratings distribution
    const ratings = await Product.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $floor: "$ratings.average" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ])

    // Get attributes
    const attributes = await Product.aggregate([
      { $match: baseQuery },
      { $unwind: "$attributes" },
      {
        $group: {
          _id: {
            name: "$attributes.name",
            value: "$attributes.value",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.name",
          values: {
            $push: {
              value: "$_id.value",
              count: "$count",
            },
          },
          totalCount: { $sum: "$count" },
        },
      },
      { $sort: { totalCount: -1 } },
    ])

    // Get tags
    const tags = await Product.aggregate([
      { $match: baseQuery },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ])

    // Compile facets
    const facets = {
      priceRange: priceRange.length > 0 ? priceRange[0] : { min: 0, max: 1000 },
      categories,
      vendors,
      ratings: ratings.map((r) => ({
        rating: r._id,
        count: r.count,
      })),
      attributes,
      tags: tags.map((t) => ({
        tag: t._id,
        count: t.count,
      })),
    }

    // Cache the facets
    await setCache(cacheKey, facets, CACHE_TTL.FACETS)

    return facets
  } catch (error: any) {
    logger.error(`Error getting facets: ${error.message}`)
    throw new ApiError(`Failed to get facets: ${error.message}`, 500)
  }
}

/**
 * Get product suggestions for autocomplete
 * @param query Search query
 * @param limit Number of suggestions to return
 * @param requestId Request ID for logging
 * @returns Product suggestions
 */
export const getProductSuggestions = async (query: string, limit = 5, requestId?: string): Promise<any[]> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting product suggestions for query: ${query}`)

  if (!query || query.trim().length < 2) {
    return []
  }

  // Try to get from cache
  const cacheKey = `suggestions:${query}:${limit}`
  const cachedSuggestions = await getCache<any[]>(cacheKey)

  if (cachedSuggestions) {
    logger.info(`Retrieved suggestions from cache`)
    return cachedSuggestions
  }

  try {
    // Search for products
    const suggestions = await Product.find(
      {
        $text: { $search: query },
        active: true,
      },
      {
        score: { $meta: "textScore" },
        _id: 1,
        name: 1,
        slug: 1,
        price: 1,
        images: 1,
      },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean()

    // Cache the suggestions
    await setCache(cacheKey, suggestions, 1800) // 30 minutes

    return suggestions
  } catch (error: any) {
    logger.error(`Error getting product suggestions: ${error.message}`)
    throw new ApiError(`Failed to get product suggestions: ${error.message}`, 500)
  }
}
