import mongoose from "mongoose";
import Product from "../models/product.model";
import Category from "../models/category.model";
import Vendor from "../models/vendor.model";
import { createRequestLogger } from "../config/logger";
import { getCache, setCache } from "../config/redis";
import { ApiError } from "../utils/api-error";

// Cache TTL in seconds
const CACHE_TTL = {
  SEARCH_RESULTS: 1800, // 30 minutes
  FACETS: 3600, // 1 hour
  SUGGESTIONS: 1800, // 30 minutes
};

/**
 * Advanced search with faceted navigation
 * @param options Search options
 * @param requestId Request ID for logging
 * @returns Search results with facets
 */
export const advancedSearch = async (
  options: {
    query?: string;
    filters?: Record<string, any>;
    page?: number;
    limit?: number;
    sort?: string;
    includeFacets?: boolean;
  } = {},
  requestId?: string
): Promise<{
  products: any[];
  count: number;
  facets?: Record<string, any>;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
  };
}> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Performing advanced search with query: ${options.query || ""}`);

  // Set default options
  const query = options.query || "";
  const filters = options.filters || {};
  const page = options.page || 1;
  const limit = options.limit || 10;
  const sort = options.sort || "relevance";
  const includeFacets = options.includeFacets !== undefined ? options.includeFacets : true;

  // Build search query
  const searchQuery: Record<string, any> = {
    active: true,
  };

  // Add text search if query is provided
  if (query && query.trim()) {
    searchQuery.$text = { $search: query };
  }

  // Process filters
  await processSearchFilters(searchQuery, filters, requestId);

  // Try to get from cache
  const cacheKey = `advanced_search:${JSON.stringify({ query, filters, page, limit, sort, includeFacets })}`;
  const cachedData = await getCache<any>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved advanced search results from cache`);
    return cachedData;
  }

  try {
    // Determine sort order
    const sortOptions = determineSortOptions(sort, query);

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute search query with projection
    const searchOptions: any = {
      skip,
      limit,
      sort: sortOptions,
    };

    // Add text score projection if using text search
    if (query && query.trim()) {
      searchOptions.projection = {
        score: { $meta: "textScore" },
      };
    }

    // Get products
    const products = await Product.find(searchQuery, searchOptions.projection)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("vendor", "businessName slug")
      .lean();

    // Get total count
    const count = await Product.countDocuments(searchQuery);

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    // Get facets if requested
    let facets = null;
    if (includeFacets) {
      facets = await getFacets(searchQuery, requestId);
    }

    // Prepare result
    const result = {
      products,
      count,
      facets,
      pagination: {
        page,
        limit,
        totalPages,
        totalResults: count,
      },
    };

    // Cache the results
    await setCache(cacheKey, result, CACHE_TTL.SEARCH_RESULTS);

    return result;
  } catch (error: any) {
    logger.error(`Error performing advanced search: ${error.message}`);
    throw new ApiError(`Failed to perform search: ${error.message}`, 500);
  }
};

/**
 * Process search filters
 * @param searchQuery Search query object to modify
 * @param filters Filter options
 * @param requestId Request ID for logging
 */
async function processSearchFilters(
  searchQuery: Record<string, any>,
  filters: Record<string, any>,
  requestId?: string
): Promise<void> {
  const logger = createRequestLogger(requestId);
  logger.info(`Processing search filters: ${JSON.stringify(filters)}`);

  try {
    // Process category filter
    if (filters.category) {
      // Check if it's a category ID or slug
      if (mongoose.Types.ObjectId.isValid(filters.category)) {
        searchQuery.category = filters.category;
      } else {
        // Find category by slug
        const category = await Category.findOne({ slug: filters.category });
        if (category) {
          searchQuery.category = category._id;
        }
      }
    }

    // Process vendor filter
    if (filters.vendor) {
      // Check if it's a vendor ID or slug
      if (mongoose.Types.ObjectId.isValid(filters.vendor)) {
        searchQuery.vendor = filters.vendor;
      } else {
        // Find vendor by slug
        const vendor = await Vendor.findOne({ slug: filters.vendor });
        if (vendor) {
          searchQuery.vendor = vendor._id;
        }
      }
    }

    // Process price filter
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      searchQuery.price = {
        $gte: Number(filters.minPrice),
        $lte: Number(filters.maxPrice),
      };
    } else if (filters.minPrice !== undefined) {
      searchQuery.price = { $gte: Number(filters.minPrice) };
    } else if (filters.maxPrice !== undefined) {
      searchQuery.price = { $lte: Number(filters.maxPrice) };
    }

    // Process rating filter
    if (filters.rating) {
      searchQuery["ratings.average"] = { $gte: Number(filters.rating) };
    }

    // Process stock filter
    if (filters.inStock !== undefined) {
      searchQuery.quantity = filters.inStock === "true" ? { $gt: 0 } : { $lte: 0 };
    }

    // Process featured filter
    if (filters.featured !== undefined) {
      searchQuery.featured = filters.featured === "true";
    }

    // Process attributes filter
    if (filters.attributes) {
      const attributeFilters = Array.isArray(filters.attributes)
        ? filters.attributes
        : [filters.attributes];

      const attributeQueries = attributeFilters.map((attr: string) => {
        const [name, value] = attr.split(":");
        return {
          attributes: {
            $elemMatch: {
              name,
              value,
            },
          },
        };
      });

      if (attributeQueries.length > 0) {
        searchQuery.$and = searchQuery.$and || [];
        searchQuery.$and.push(...attributeQueries);
      }
    }

    // Process tags filter
    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      searchQuery.tags = { $in: tags };
    }

    // Process discount filter
    if (filters.onSale === "true") {
      searchQuery.compareAtPrice = { $gt: 0, $gt: "$price" };
    }

    // Process date filter
    if (filters.createdAfter) {
      searchQuery.createdAt = { $gte: new Date(filters.createdAfter) };
    }

    if (filters.createdBefore) {
      searchQuery.createdAt = {
        ...searchQuery.createdAt,
        $lte: new Date(filters.createdBefore),
      };
    }
  } catch (error: any) {
    logger.error(`Error processing search filters: ${error.message}`);
    throw error;
  }
}

/**
 * Determine sort options based on sort parameter
 * @param sort Sort parameter
 * @param query Search query
 * @returns Sort options
 */
function determineSortOptions(sort: string, query: string): Record<string, any> {
  let sortOptions: Record<string, any> = {};

  if (sort === "relevance" && query && query.trim()) {
    sortOptions = { score: { $meta: "textScore" } };
  } else if (sort === "price_asc") {
    sortOptions = { price: 1 };
  } else if (sort === "price_desc") {
    sortOptions = { price: -1 };
  } else if (sort === "newest") {
    sortOptions = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortOptions = { createdAt: 1 };
  } else if (sort === "rating") {
    sortOptions = { "ratings.average": -1 };
  } else if (sort === "popularity") {
    sortOptions = { "ratings.count": -1 };
  } else if (sort === "name_asc") {
    sortOptions = { name: 1 };
  } else if (sort === "name_desc") {
    sortOptions = { name: -1 };
  } else {
    // Default sort
    sortOptions = { createdAt: -1 };
  }

  return sortOptions;
}

/**
 * Get facets for search results
 * @param baseQuery Base query for facets
 * @param requestId Request ID for logging
 * @returns Facets for search results
 */
export const getFacets = async (
  baseQuery: Record<string, any>,
  requestId?: string
): Promise<Record<string, any>> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting facets for search results");

  // Try to get from cache
  const cacheKey = `facets:${JSON.stringify(baseQuery)}`;
  const cachedFacets = await getCache<Record<string, any>>(cacheKey);

  if (cachedFacets) {
    logger.info(`Retrieved facets from cache`);
    return cachedFacets;
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
    ]);

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
    ]);

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
    ]);

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
    ]);

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
    ]);

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
    ]);

    // Get discount status
    const discountStatus = await Product.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $gt: ["$compareAtPrice", "$price"] },
          count: { $sum: 1 },
        },
      },
    ]);

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
      discountStatus: discountStatus.map((d) => ({
        onSale: d._id,
        count: d.count,
      })),
    };

    // Cache the facets
    await setCache(cacheKey, facets, CACHE_TTL.FACETS);

    return facets;
  } catch (error: any) {
    logger.error(`Error getting facets: ${error.message}`);
    throw new ApiError(`Failed to get facets: ${error.message}`, 500);
  }
};

/**
 * Get product suggestions for autocomplete
 * @param query Search query
 * @param options Suggestion options
 * @param requestId Request ID for logging
 * @returns Product suggestions
 */
export const getProductSuggestions = async (
  query: string,
  options: {
    limit?: number;
    includeCategories?: boolean;
    includeVendors?: boolean;
  } = {},
  requestId?: string
): Promise<{
  products: any[];
  categories?: any[];
  vendors?: any[];
}> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting product suggestions for query: ${query}`);

  if (!query || query.trim().length < 2) {
    return { products: [] };
  }

  // Set default options
  const limit = options.limit || 5;
  const includeCategories =
    options.includeCategories !== undefined ? options.includeCategories : true;
  const includeVendors = options.includeVendors !== undefined ? options.includeVendors : true;

  // Try to get from cache
  const cacheKey = `suggestions:${query}:${limit}:${includeCategories}:${includeVendors}`;
  const cachedSuggestions = await getCache<any>(cacheKey);

  if (cachedSuggestions) {
    logger.info(`Retrieved suggestions from cache`);
    return cachedSuggestions;
  }

  try {
    // Search for products
    const products = await Product.find(
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
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();

    // Prepare result
    const result: {
      products: any[];
      categories?: any[];
      vendors?: any[];
    } = {
      products,
    };

    // Search for categories if requested
    if (includeCategories) {
      const categories = await Category.find(
        {
          $text: { $search: query },
        },
        {
          score: { $meta: "textScore" },
          _id: 1,
          name: 1,
          slug: 1,
        }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(3)
        .lean();

      result.categories = categories;
    }

    // Search for vendors if requested
    if (includeVendors) {
      const vendors = await Vendor.find(
        {
          $text: { $search: query },
          status: "approved",
        },
        {
          score: { $meta: "textScore" },
          _id: 1,
          businessName: 1,
          slug: 1,
        }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(3)
        .lean();

      result.vendors = vendors;
    }

    // Cache the suggestions
    await setCache(cacheKey, result, CACHE_TTL.SUGGESTIONS);

    return result;
  } catch (error: any) {
    logger.error(`Error getting product suggestions: ${error.message}`);
    throw new ApiError(`Failed to get product suggestions: ${error.message}`, 500);
  }
};

/**
 * Get popular searches
 * @param limit Number of popular searches to return
 * @param requestId Request ID for logging
 * @returns Popular searches
 */
export const getPopularSearches = async (limit = 10, requestId?: string): Promise<string[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting popular searches, limit: ${limit}`);

  // This is a placeholder implementation
  // In a real application, you would track search queries and their frequency
  // For now, we'll return dummy data
  return [
    "smartphone",
    "laptop",
    "headphones",
    "camera",
    "smartwatch",
    "tablet",
    "bluetooth speaker",
    "gaming console",
    "wireless earbuds",
    "smart tv",
  ];
};
