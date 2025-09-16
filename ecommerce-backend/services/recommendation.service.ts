import mongoose from "mongoose";
import Product from "../models/product.model";
import Order from "../models/order.model";
import User from "../models/user.model";
import { createRequestLogger } from "../config/logger";
import { getCache, setCache } from "../config/redis";
import { ApiError } from "../utils/api-error";

// Cache TTL in seconds
const CACHE_TTL = {
  POPULAR_PRODUCTS: 3600, // 1 hour
  RELATED_PRODUCTS: 3600, // 1 hour
  PERSONALIZED_RECOMMENDATIONS: 86400, // 24 hours
  RECENTLY_VIEWED: 86400, // 24 hours
};

/**
 * Get popular products
 * @param limit Number of products to return
 * @param requestId Request ID for logging
 * @returns Array of popular products
 */
export const getPopularProducts = async (limit = 10, requestId?: string): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting popular products with limit: ${limit}`);

  // Try to get from cache
  const cacheKey = `popular_products:${limit}`;
  const cachedData = await getCache<any[]>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved popular products from cache`);
    return cachedData;
  }

  try {
    // Get products with highest average rating and at least 5 reviews
    const popularProducts = await Product.aggregate([
      { $match: { active: true, "ratings.count": { $gte: 5 } } },
      { $sort: { "ratings.average": -1, "ratings.count": -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          price: 1,
          compareAtPrice: 1,
          images: 1,
          category: 1,
          ratings: 1,
          quantity: 1,
          featured: 1,
        },
      },
    ]);

    // If not enough products with ratings, get products with most orders
    if (popularProducts.length < limit) {
      const remainingLimit = limit - popularProducts.length;

      // Get product IDs that are already in popularProducts
      const existingProductIds = popularProducts.map((product) => product._id);

      // Get products with most orders
      const mostOrderedProducts = await Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $unwind: "$orderItems" },
        { $group: { _id: "$orderItems.product", orderCount: { $sum: 1 } } },
        { $match: { _id: { $nin: existingProductIds } } },
        { $sort: { orderCount: -1 } },
        { $limit: remainingLimit },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $match: { "product.active": true } },
        {
          $project: {
            _id: "$product._id",
            name: "$product.name",
            description: "$product.description",
            price: "$product.price",
            compareAtPrice: "$product.compareAtPrice",
            images: "$product.images",
            category: "$product.category",
            ratings: "$product.ratings",
            quantity: "$product.quantity",
            featured: "$product.featured",
          },
        },
      ]);

      // Combine the results
      popularProducts.push(...mostOrderedProducts);
    }

    // If still not enough products, get featured products
    if (popularProducts.length < limit) {
      const remainingLimit = limit - popularProducts.length;

      // Get product IDs that are already in popularProducts
      const existingProductIds = popularProducts.map((product) => product._id);

      // Get featured products
      const featuredProducts = await Product.find({
        _id: { $nin: existingProductIds },
        active: true,
        featured: true,
      })
        .sort({ createdAt: -1 })
        .limit(remainingLimit)
        .select(
          "_id name description price compareAtPrice images category ratings quantity featured"
        )
        .lean();

      // Combine the results
      popularProducts.push(...featuredProducts);
    }

    // If still not enough products, get newest products
    if (popularProducts.length < limit) {
      const remainingLimit = limit - popularProducts.length;

      // Get product IDs that are already in popularProducts
      const existingProductIds = popularProducts.map((product) => product._id);

      // Get newest products
      const newestProducts = await Product.find({
        _id: { $nin: existingProductIds },
        active: true,
      })
        .sort({ createdAt: -1 })
        .limit(remainingLimit)
        .select(
          "_id name description price compareAtPrice images category ratings quantity featured"
        )
        .lean();

      // Combine the results
      popularProducts.push(...newestProducts);
    }

    // Cache the results
    await setCache(cacheKey, popularProducts, CACHE_TTL.POPULAR_PRODUCTS);

    return popularProducts;
  } catch (error) {
    logger.error(`Error getting popular products: ${error.message}`);
    throw new ApiError(`Failed to get popular products: ${error.message}`, 500);
  }
};

/**
 * Get related products for a specific product
 * @param productId Product ID
 * @param limit Number of products to return
 * @param requestId Request ID for logging
 * @returns Array of related products
 */
export const getRelatedProducts = async (
  productId: string,
  limit = 10,
  requestId?: string
): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting related products for product ID: ${productId} with limit: ${limit}`);

  // Validate product ID
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError("Invalid product ID", 400);
  }

  // Try to get from cache
  const cacheKey = `related_products:${productId}:${limit}`;
  const cachedData = await getCache<any[]>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved related products from cache`);
    return cachedData;
  }

  try {
    // Get the product to find related products
    const product = await Product.findById(productId).select("category").lean();

    if (!product) {
      throw new ApiError("Product not found", 404);
    }

    // Get products in the same category
    const relatedProducts = await Product.find({
      _id: { $ne: productId },
      category: product.category,
      active: true,
    })
      .sort({ "ratings.average": -1 })
      .limit(limit)
      .select("_id name description price compareAtPrice images category ratings quantity featured")
      .lean();

    // If not enough products in the same category, get products from other categories
    if (relatedProducts.length < limit) {
      const remainingLimit = limit - relatedProducts.length;

      // Get product IDs that are already in relatedProducts
      const existingProductIds = [...relatedProducts.map((product) => product._id), productId];

      // Get products with highest ratings
      const otherProducts = await Product.find({
        _id: { $nin: existingProductIds },
        active: true,
      })
        .sort({ "ratings.average": -1, "ratings.count": -1 })
        .limit(remainingLimit)
        .select(
          "_id name description price compareAtPrice images category ratings quantity featured"
        )
        .lean();

      // Combine the results
      relatedProducts.push(...otherProducts);
    }

    // Cache the results
    await setCache(cacheKey, relatedProducts, CACHE_TTL.RELATED_PRODUCTS);

    return relatedProducts;
  } catch (error) {
    logger.error(`Error getting related products: ${error.message}`);
    throw error;
  }
};

/**
 * Get personalized recommendations for a user
 * @param userId User ID
 * @param limit Number of products to return
 * @param requestId Request ID for logging
 * @returns Array of recommended products
 */
export const getPersonalizedRecommendations = async (
  userId: string,
  limit = 10,
  requestId?: string
): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting personalized recommendations for user ID: ${userId} with limit: ${limit}`);

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError("Invalid user ID", 400);
  }

  // Try to get from cache
  const cacheKey = `personalized_recommendations:${userId}:${limit}`;
  const cachedData = await getCache<any[]>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved personalized recommendations from cache`);
    return cachedData;
  }

  try {
    // Check if user exists
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // Get user's order history
    const userOrders = await Order.find({
      user: userId,
      status: { $ne: "cancelled" },
    })
      .sort({ createdAt: -1 })
      .select("orderItems")
      .lean();

    // If user has no orders, return popular products
    if (!userOrders.length) {
      logger.info(`User has no orders, returning popular products`);
      return getPopularProducts(limit, requestId);
    }

    // Extract product IDs from user's orders
    const orderedProductIds = userOrders.flatMap((order) =>
      order.orderItems.map((item) => item.product.toString())
    );

    // Get unique product IDs
    const uniqueOrderedProductIds = [...new Set(orderedProductIds)];

    // Get categories of ordered products
    const orderedProducts = await Product.find({
      _id: { $in: uniqueOrderedProductIds },
    })
      .select("category")
      .lean();

    const orderedCategoryIds = orderedProducts.map((product) => product.category.toString());
    const uniqueOrderedCategoryIds = [...new Set(orderedCategoryIds)];

    // Get products from the same categories that the user hasn't ordered
    const recommendedProducts = await Product.find({
      _id: { $nin: uniqueOrderedProductIds },
      category: { $in: uniqueOrderedCategoryIds },
      active: true,
    })
      .sort({ "ratings.average": -1 })
      .limit(limit)
      .select("_id name description price compareAtPrice images category ratings quantity featured")
      .lean();

    // If not enough products from the same categories, get popular products
    if (recommendedProducts.length < limit) {
      const remainingLimit = limit - recommendedProducts.length;

      // Get product IDs that are already in recommendedProducts
      const existingProductIds = [
        ...recommendedProducts.map((product) => product._id),
        ...uniqueOrderedProductIds,
      ];

      // Get popular products
      const popularProducts = await Product.find({
        _id: { $nin: existingProductIds },
        active: true,
      })
        .sort({ "ratings.average": -1, "ratings.count": -1 })
        .limit(remainingLimit)
        .select(
          "_id name description price compareAtPrice images category ratings quantity featured"
        )
        .lean();

      // Combine the results
      recommendedProducts.push(...popularProducts);
    }

    // Cache the results
    await setCache(cacheKey, recommendedProducts, CACHE_TTL.PERSONALIZED_RECOMMENDATIONS);

    return recommendedProducts;
  } catch (error) {
    logger.error(`Error getting personalized recommendations: ${error.message}`);
    throw error;
  }
};

/**
 * Track recently viewed products for a user
 * @param userId User ID
 * @param productId Product ID
 * @param requestId Request ID for logging
 */
export const trackRecentlyViewedProduct = async (
  userId: string,
  productId: string,
  requestId?: string
): Promise<void> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Tracking recently viewed product for user ID: ${userId}, product ID: ${productId}`);

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError("Invalid user ID or product ID", 400);
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId).lean();

    if (!product) {
      throw new ApiError("Product not found", 404);
    }

    // Get recently viewed products from cache
    const cacheKey = `recently_viewed:${userId}`;
    const recentlyViewed = (await getCache<string[]>(cacheKey)) || [];

    // Remove the product if it's already in the list
    const updatedRecentlyViewed = recentlyViewed.filter((id) => id !== productId);

    // Add the product to the beginning of the list
    updatedRecentlyViewed.unshift(productId);

    // Keep only the last 20 viewed products
    const limitedRecentlyViewed = updatedRecentlyViewed.slice(0, 20);

    // Update the cache
    await setCache(cacheKey, limitedRecentlyViewed, CACHE_TTL.RECENTLY_VIEWED);
  } catch (error) {
    logger.error(`Error tracking recently viewed product: ${error.message}`);
    throw error;
  }
};

/**
 * Get recently viewed products for a user
 * @param userId User ID
 * @param limit Number of products to return
 * @param requestId Request ID for logging
 * @returns Array of recently viewed products
 */
export const getRecentlyViewedProducts = async (
  userId: string,
  limit = 10,
  requestId?: string
): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting recently viewed products for user ID: ${userId} with limit: ${limit}`);

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError("Invalid user ID", 400);
  }

  try {
    // Get recently viewed products from cache
    const cacheKey = `recently_viewed:${userId}`;
    const recentlyViewed = (await getCache<string[]>(cacheKey)) || [];

    // If no recently viewed products, return popular products
    if (!recentlyViewed.length) {
      logger.info(`User has no recently viewed products, returning popular products`);
      return getPopularProducts(limit, requestId);
    }

    // Limit the number of products
    const limitedRecentlyViewed = recentlyViewed.slice(0, limit);

    // Get product details
    const products = await Product.find({
      _id: { $in: limitedRecentlyViewed },
      active: true,
    })
      .select("_id name description price compareAtPrice images category ratings quantity featured")
      .lean();

    // Sort products in the same order as recentlyViewed
    const sortedProducts = limitedRecentlyViewed
      .map((id) => products.find((product) => product._id.toString() === id))
      .filter(Boolean); // Remove undefined values

    return sortedProducts;
  } catch (error) {
    logger.error(`Error getting recently viewed products: ${error.message}`);
    throw error;
  }
};

/**
 * Get "Frequently Bought Together" products for a specific product
 * @param productId Product ID
 * @param limit Number of products to return
 * @param requestId Request ID for logging
 * @returns Array of frequently bought together products
 */
export const getFrequentlyBoughtTogether = async (
  productId: string,
  limit = 3,
  requestId?: string
): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(
    `Getting frequently bought together products for product ID: ${productId} with limit: ${limit}`
  );

  // Validate product ID
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError("Invalid product ID", 400);
  }

  // Try to get from cache
  const cacheKey = `frequently_bought_together:${productId}:${limit}`;
  const cachedData = await getCache<any[]>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved frequently bought together products from cache`);
    return cachedData;
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId).lean();

    if (!product) {
      throw new ApiError("Product not found", 404);
    }

    // Find orders containing the product
    const ordersWithProduct = await Order.find({
      "orderItems.product": productId,
      status: { $ne: "cancelled" },
    })
      .select("orderItems")
      .lean();

    // If no orders found, return related products
    if (!ordersWithProduct.length) {
      logger.info(`No orders found with product ID: ${productId}, returning related products`);
      return getRelatedProducts(productId, limit, requestId);
    }

    // Count co-occurrence of products
    const productCounts = new Map<string, number>();

    ordersWithProduct.forEach((order) => {
      order.orderItems.forEach((item) => {
        const itemProductId = item.product.toString();

        // Skip the original product
        if (itemProductId === productId) {
          return;
        }

        const currentCount = productCounts.get(itemProductId) || 0;
        productCounts.set(itemProductId, currentCount + 1);
      });
    });

    // Sort products by co-occurrence count
    const sortedProductIds = [...productCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    // Get product details
    const frequentlyBoughtTogether = await Product.find({
      _id: { $in: sortedProductIds },
      active: true,
    })
      .select("_id name description price compareAtPrice images category ratings quantity featured")
      .lean();

    // Sort products in the same order as sortedProductIds
    const sortedProducts = sortedProductIds
      .map((id) => frequentlyBoughtTogether.find((product) => product._id.toString() === id))
      .filter(Boolean); // Remove undefined values

    // If not enough products, get related products
    if (sortedProducts.length < limit) {
      const remainingLimit = limit - sortedProducts.length;

      // Get product IDs that are already in sortedProducts
      const existingProductIds = [
        ...sortedProducts.map((product) => product._id.toString()),
        productId,
      ];

      // Get related products
      const relatedProducts = await Product.find({
        _id: { $nin: existingProductIds },
        category: product.category,
        active: true,
      })
        .sort({ "ratings.average": -1 })
        .limit(remainingLimit)
        .select(
          "_id name description price compareAtPrice images category ratings quantity featured"
        )
        .lean();

      // Combine the results
      sortedProducts.push(...relatedProducts);
    }

    // Cache the results
    await setCache(cacheKey, sortedProducts, CACHE_TTL.RELATED_PRODUCTS);

    return sortedProducts;
  } catch (error) {
    logger.error(`Error getting frequently bought together products: ${error.message}`);
    throw error;
  }
};
