import mongoose from "mongoose";
import Vendor, { type IVendorDocument } from "../models/vendor.model";
import Product from "../models/product.model";
import Payout from "../models/payout.model";
import Order from "../models/order.model";
import { createRequestLogger } from "../config/logger";
import { ApiError } from "../utils/api-error";
import slugify from "slugify";
import { getCache, setCache } from "../config/redis";

// Cache TTL in seconds
const CACHE_TTL = {
  VENDOR: 3600, // 1 hour
  VENDORS_LIST: 1800, // 30 minutes
  VENDOR_PRODUCTS: 1800, // 30 minutes
  VENDOR_METRICS: 3600, // 1 hour
};

/**
 * Create a new vendor
 * @param vendorData Vendor data
 * @param requestId Request ID for logging
 * @returns Created vendor
 */
export const createVendor = async (
  vendorData: Partial<IVendorDocument>,
  requestId?: string
): Promise<IVendorDocument> => {
  const logger = createRequestLogger(requestId);
  logger.info("Creating new vendor");

  try {
    // Check if vendor with same email already exists
    const existingVendor = await Vendor.findOne({ email: vendorData.email });
    if (existingVendor) {
      throw new ApiError("Vendor with this email already exists", 400);
    }

    // Generate slug from business name
    const slug = slugify(vendorData.businessName || "", { lower: true });

    // Check if slug already exists
    const existingSlug = await Vendor.findOne({ slug });
    if (existingSlug) {
      // Append a random string to make the slug unique
      vendorData.slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
    } else {
      vendorData.slug = slug;
    }

    // Create new vendor
    const vendor = await Vendor.create(vendorData);
    logger.info(`Vendor created with ID: ${vendor._id}`);

    return vendor;
  } catch (error: any) {
    logger.error(`Error creating vendor: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor by ID
 * @param vendorId Vendor ID
 * @param requestId Request ID for logging
 * @returns Vendor document
 */
export const getVendorById = async (
  vendorId: string,
  requestId?: string
): Promise<IVendorDocument> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting vendor with ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Try to get from cache
  const cacheKey = `vendor:${vendorId}`;
  const cachedVendor = await getCache<IVendorDocument>(cacheKey);

  if (cachedVendor) {
    logger.info(`Retrieved vendor from cache`);
    return cachedVendor;
  }

  try {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Cache the vendor
    await setCache(cacheKey, vendor, CACHE_TTL.VENDOR);

    return vendor;
  } catch (error: any) {
    logger.error(`Error getting vendor: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor by slug
 * @param slug Vendor slug
 * @param requestId Request ID for logging
 * @returns Vendor document
 */
export const getVendorBySlug = async (
  slug: string,
  requestId?: string
): Promise<IVendorDocument> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting vendor with slug: ${slug}`);

  // Try to get from cache
  const cacheKey = `vendor:slug:${slug}`;
  const cachedVendor = await getCache<IVendorDocument>(cacheKey);

  if (cachedVendor) {
    logger.info(`Retrieved vendor from cache`);
    return cachedVendor;
  }

  try {
    const vendor = await Vendor.findOne({ slug });

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Cache the vendor
    await setCache(cacheKey, vendor, CACHE_TTL.VENDOR);

    return vendor;
  } catch (error: any) {
    logger.error(`Error getting vendor: ${error.message}`);
    throw error;
  }
};

/**
 * Update vendor
 * @param vendorId Vendor ID
 * @param updateData Update data
 * @param requestId Request ID for logging
 * @returns Updated vendor
 */
export const updateVendor = async (
  vendorId: string,
  updateData: Partial<IVendorDocument>,
  requestId?: string
): Promise<IVendorDocument> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating vendor with ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // If business name is being updated, update slug as well
    if (updateData.businessName) {
      const newSlug = slugify(updateData.businessName, { lower: true });

      // Check if new slug already exists and is not the current vendor
      const existingSlug = await Vendor.findOne({ slug: newSlug, _id: { $ne: vendorId } });
      if (existingSlug) {
        // Append a random string to make the slug unique
        updateData.slug = `${newSlug}-${Math.random().toString(36).substring(2, 8)}`;
      } else {
        updateData.slug = newSlug;
      }
    }

    // Update vendor
    const updatedVendor = await Vendor.findByIdAndUpdate(vendorId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedVendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Invalidate cache
    const cacheKey = `vendor:${vendorId}`;
    const slugCacheKey = `vendor:slug:${vendor.slug}`;
    await Promise.all([
      getCache(cacheKey).then((cached) => cached && setCache(cacheKey, null, 1)),
      getCache(slugCacheKey).then((cached) => cached && setCache(slugCacheKey, null, 1)),
      getCache("vendors:list").then((cached) => cached && setCache("vendors:list", null, 1)),
    ]);

    logger.info(`Vendor updated successfully`);

    return updatedVendor;
  } catch (error: any) {
    logger.error(`Error updating vendor: ${error.message}`);
    throw error;
  }
};

/**
 * Delete vendor
 * @param vendorId Vendor ID
 * @param requestId Request ID for logging
 * @returns Deleted vendor
 */
export const deleteVendor = async (
  vendorId: string,
  requestId?: string
): Promise<IVendorDocument> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Deleting vendor with ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  try {
    // Check if vendor has products
    const productsCount = await Product.countDocuments({ vendor: vendorId });
    if (productsCount > 0) {
      throw new ApiError("Cannot delete vendor with existing products", 400);
    }

    // Check if vendor has pending payouts
    const pendingPayoutsCount = await Payout.countDocuments({
      vendor: vendorId,
      status: { $in: ["pending", "processing"] },
    });
    if (pendingPayoutsCount > 0) {
      throw new ApiError("Cannot delete vendor with pending payouts", 400);
    }

    // Delete vendor
    const vendor = await Vendor.findByIdAndDelete(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Invalidate cache
    const cacheKey = `vendor:${vendorId}`;
    const slugCacheKey = `vendor:slug:${vendor.slug}`;
    await Promise.all([
      getCache(cacheKey).then((cached) => cached && setCache(cacheKey, null, 1)),
      getCache(slugCacheKey).then((cached) => cached && setCache(slugCacheKey, null, 1)),
      getCache("vendors:list").then((cached) => cached && setCache("vendors:list", null, 1)),
    ]);

    logger.info(`Vendor deleted successfully`);

    return vendor;
  } catch (error: any) {
    logger.error(`Error deleting vendor: ${error.message}`);
    throw error;
  }
};

/**
 * Get all vendors
 * @param filter Filter options
 * @param options Pagination and sorting options
 * @param requestId Request ID for logging
 * @returns List of vendors and count
 */
export const getAllVendors = async (
  filter: Record<string, any> = {},
  options: {
    page?: number;
    limit?: number;
    sort?: string;
    select?: string;
  } = {},
  requestId?: string
): Promise<{ vendors: IVendorDocument[]; count: number }> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting all vendors");

  const { page = 1, limit = 10, sort = "-createdAt", select } = options;

  // Build query
  const query: Record<string, any> = { ...filter };

  // Try to get from cache if no filters are applied
  const isDefaultQuery =
    Object.keys(filter).length === 0 &&
    page === 1 &&
    limit === 10 &&
    sort === "-createdAt" &&
    !select;
  if (isDefaultQuery) {
    const cacheKey = "vendors:list";
    const cachedData = await getCache<{ vendors: IVendorDocument[]; count: number }>(cacheKey);

    if (cachedData) {
      logger.info(`Retrieved vendors from cache`);
      return cachedData;
    }
  }

  try {
    // Execute query with pagination
    const skip = (page - 1) * limit;

    // Get vendors
    const vendors = await Vendor.find(query).sort(sort).skip(skip).limit(limit).select(select);

    // Get total count
    const count = await Vendor.countDocuments(query);

    // Cache the results if it's the default query
    if (isDefaultQuery) {
      const cacheKey = "vendors:list";
      await setCache(cacheKey, { vendors, count }, CACHE_TTL.VENDORS_LIST);
    }

    return { vendors, count };
  } catch (error: any) {
    logger.error(`Error getting vendors: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor products
 * @param vendorId Vendor ID
 * @param options Pagination and filtering options
 * @param requestId Request ID for logging
 * @returns List of products and count
 */
export const getVendorProducts = async (
  vendorId: string,
  options: {
    page?: number;
    limit?: number;
    sort?: string;
    filter?: Record<string, any>;
  } = {},
  requestId?: string
): Promise<{ products: any[]; count: number }> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting products for vendor ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  const { page = 1, limit = 10, sort = "-createdAt", filter = {} } = options;

  // Build query
  const query: Record<string, any> = { vendor: vendorId, ...filter };

  // Try to get from cache if no filters are applied
  const isDefaultQuery =
    Object.keys(filter).length === 0 && page === 1 && limit === 10 && sort === "-createdAt";
  if (isDefaultQuery) {
    const cacheKey = `vendor:${vendorId}:products`;
    const cachedData = await getCache<{ products: any[]; count: number }>(cacheKey);

    if (cachedData) {
      logger.info(`Retrieved vendor products from cache`);
      return cachedData;
    }
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    // Get products
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category", "name");

    // Get total count
    const count = await Product.countDocuments(query);

    // Cache the results if it's the default query
    if (isDefaultQuery) {
      const cacheKey = `vendor:${vendorId}:products`;
      await setCache(cacheKey, { products, count }, CACHE_TTL.VENDOR_PRODUCTS);
    }

    return { products, count };
  } catch (error: any) {
    logger.error(`Error getting vendor products: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor metrics
 * @param vendorId Vendor ID
 * @param period Period for metrics calculation
 * @param requestId Request ID for logging
 * @returns Vendor metrics
 */
export const getVendorMetrics = async (
  vendorId: string,
  period: "day" | "week" | "month" | "year" | "all" = "all",
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting metrics for vendor ID: ${vendorId} with period: ${period}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Try to get from cache
  const cacheKey = `vendor:${vendorId}:metrics:${period}`;
  const cachedData = await getCache<any>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved vendor metrics from cache`);
    return cachedData;
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date(0); // Unix epoch

    if (period === "day") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === "month") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === "year") {
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
    }

    // Get orders for this vendor
    const orders = await Order.find({
      "orderItems.vendor": vendorId,
      createdAt: { $gte: startDate },
      status: { $ne: "cancelled" },
    }).lean();

    // Calculate metrics
    let totalSales = 0;
    let totalOrders = 0;
    let totalItems = 0;
    let totalRevenue = 0;
    let totalCommission = 0;

    // Process orders
    orders.forEach((order) => {
      // Filter order items for this vendor
      const vendorItems = order.orderItems.filter(
        (item) => item.vendor && item.vendor.toString() === vendorId
      );

      if (vendorItems.length > 0) {
        totalOrders++;
        totalItems += vendorItems.length;

        // Calculate sales and commission
        vendorItems.forEach((item) => {
          const itemTotal = item.price * item.quantity;
          totalSales += itemTotal;
          totalRevenue += itemTotal;

          // Calculate commission if available
          if (item.commission) {
            totalCommission += (itemTotal * item.commission) / 100;
          } else if (vendor.commissionRate) {
            totalCommission += (itemTotal * vendor.commissionRate) / 100;
          }
        });
      }
    });

    // Get product count
    const productCount = await Product.countDocuments({ vendor: vendorId });

    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Get total views (if available)
    // This would require a separate analytics tracking system
    const totalViews = 0; // Placeholder

    // Calculate conversion rate
    const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

    // Compile metrics
    const metrics = {
      period,
      totalSales,
      totalRevenue,
      totalCommission,
      netRevenue: totalRevenue - totalCommission,
      totalOrders,
      totalItems,
      productCount,
      averageOrderValue,
      conversionRate,
      startDate,
      endDate: now,
    };

    // Cache the results
    await setCache(cacheKey, metrics, CACHE_TTL.VENDOR_METRICS);

    return metrics;
  } catch (error: any) {
    logger.error(`Error getting vendor metrics: ${error.message}`);
    throw error;
  }
};

/**
 * Update vendor status
 * @param vendorId Vendor ID
 * @param status New status
 * @param notes Optional notes for status change
 * @param requestId Request ID for logging
 * @returns Updated vendor
 */
export const updateVendorStatus = async (
  vendorId: string,
  status: "pending" | "approved" | "rejected" | "suspended",
  notes?: string,
  requestId?: string
): Promise<IVendorDocument> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating status for vendor ID: ${vendorId} to ${status}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Update vendor status
    const updateData: any = { status };
    if (notes) {
      updateData.verificationNotes = notes;
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(vendorId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedVendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Invalidate cache
    const cacheKey = `vendor:${vendorId}`;
    const slugCacheKey = `vendor:slug:${vendor.slug}`;
    await Promise.all([
      getCache(cacheKey).then((cached) => cached && setCache(cacheKey, null, 1)),
      getCache(slugCacheKey).then((cached) => cached && setCache(slugCacheKey, null, 1)),
      getCache("vendors:list").then((cached) => cached && setCache("vendors:list", null, 1)),
    ]);

    logger.info(`Vendor status updated successfully to ${status}`);

    return updatedVendor;
  } catch (error: any) {
    logger.error(`Error updating vendor status: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor payouts
 * @param vendorId Vendor ID
 * @param options Pagination and filtering options
 * @param requestId Request ID for logging
 * @returns List of payouts and count
 */
export const getVendorPayouts = async (
  vendorId: string,
  options: {
    page?: number;
    limit?: number;
    sort?: string;
    filter?: Record<string, any>;
  } = {},
  requestId?: string
): Promise<{ payouts: any[]; count: number }> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting payouts for vendor ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  const { page = 1, limit = 10, sort = "-createdAt", filter = {} } = options;

  // Build query
  const query: Record<string, any> = { vendor: vendorId, ...filter };

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    // Get payouts
    const payouts = await Payout.find(query).sort(sort).skip(skip).limit(limit);

    // Get total count
    const count = await Payout.countDocuments(query);

    return { payouts, count };
  } catch (error: any) {
    logger.error(`Error getting vendor payouts: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate vendor payout
 * @param vendorId Vendor ID
 * @param startDate Start date for payout period
 * @param endDate End date for payout period
 * @param requestId Request ID for logging
 * @returns Payout calculation
 */
export const calculateVendorPayout = async (
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Calculating payout for vendor ID: ${vendorId} from ${startDate} to ${endDate}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Check if there's already a payout for this period
    const existingPayout = await Payout.findOne({
      vendor: vendorId,
      periodStart: { $lte: endDate },
      periodEnd: { $gte: startDate },
    });

    if (existingPayout) {
      throw new ApiError("A payout already exists for this period", 400);
    }

    // Get orders for this vendor in the specified period
    const orders = await Order.find({
      "orderItems.vendor": vendorId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: "cancelled" },
      isPaid: true,
    }).lean();

    // Calculate payout amount
    let totalAmount = 0;
    let totalCommission = 0;
    const orderIds: mongoose.Types.ObjectId[] = [];

    // Process orders
    orders.forEach((order) => {
      // Filter order items for this vendor
      const vendorItems = order.orderItems.filter(
        (item) => item.vendor && item.vendor.toString() === vendorId
      );

      if (vendorItems.length > 0) {
        orderIds.push(order._id);

        // Calculate sales and commission
        vendorItems.forEach((item) => {
          const itemTotal = item.price * item.quantity;
          totalAmount += itemTotal;

          // Calculate commission if available
          if (item.commission) {
            totalCommission += (itemTotal * item.commission) / 100;
          } else if (vendor.commissionRate) {
            totalCommission += (itemTotal * vendor.commissionRate) / 100;
          }
        });
      }
    });

    // Calculate net amount
    const netAmount = totalAmount - totalCommission;

    // Check if amount meets minimum payout
    if (netAmount < vendor.minimumPayoutAmount) {
      throw new ApiError(
        `Payout amount (${netAmount}) is less than minimum payout amount (${vendor.minimumPayoutAmount})`,
        400
      );
    }

    // Generate reference
    const reference = `PAY-${vendorId.substring(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

    // Create payout calculation
    const payoutCalculation = {
      vendor: vendorId,
      amount: totalAmount,
      fee: totalCommission,
      netAmount,
      currency: "USD", // Default currency
      status: "pending",
      paymentMethod: vendor.bankAccounts.length > 0 ? "bank_transfer" : "other",
      reference,
      periodStart: startDate,
      periodEnd: endDate,
      orders: orderIds,
      orderCount: orderIds.length,
    };

    return payoutCalculation;
  } catch (error: any) {
    logger.error(`Error calculating vendor payout: ${error.message}`);
    throw error;
  }
};

/**
 * Create vendor payout
 * @param payoutData Payout data
 * @param requestId Request ID for logging
 * @returns Created payout
 */
export const createVendorPayout = async (payoutData: any, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Creating payout for vendor ID: ${payoutData.vendor}`);

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(payoutData.vendor);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Check if there's already a payout for this period
    const existingPayout = await Payout.findOne({
      vendor: payoutData.vendor,
      periodStart: { $lte: payoutData.periodEnd },
      periodEnd: { $gte: payoutData.periodStart },
    });

    if (existingPayout) {
      throw new ApiError("A payout already exists for this period", 400);
    }

    // Create payout
    const payout = await Payout.create(payoutData);
    logger.info(`Payout created with ID: ${payout._id}`);

    return payout;
  } catch (error: any) {
    logger.error(`Error creating vendor payout: ${error.message}`);
    throw error;
  }
};

/**
 * Update payout status
 * @param payoutId Payout ID
 * @param status New status
 * @param transactionId Optional transaction ID
 * @param notes Optional notes
 * @param requestId Request ID for logging
 * @returns Updated payout
 */
export const updatePayoutStatus = async (
  payoutId: string,
  status: "pending" | "processing" | "completed" | "failed" | "cancelled",
  transactionId?: string,
  notes?: string,
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating status for payout ID: ${payoutId} to ${status}`);

  // Validate payout ID
  if (!mongoose.Types.ObjectId.isValid(payoutId)) {
    throw new ApiError("Invalid payout ID", 400);
  }

  try {
    // Check if payout exists
    const payout = await Payout.findById(payoutId);

    if (!payout) {
      throw new ApiError("Payout not found", 404);
    }

    // Update payout status
    const updateData: any = { status };

    if (status === "completed") {
      updateData.processedAt = new Date();
    }

    if (transactionId) {
      updateData.transactionId = transactionId;
    }

    if (notes) {
      updateData.notes = notes;
    }

    const updatedPayout = await Payout.findByIdAndUpdate(payoutId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedPayout) {
      throw new ApiError("Payout not found", 404);
    }

    logger.info(`Payout status updated successfully to ${status}`);

    return updatedPayout;
  } catch (error: any) {
    logger.error(`Error updating payout status: ${error.message}`);
    throw error;
  }
};

/**
 * Get payout by ID
 * @param payoutId Payout ID
 * @param requestId Request ID for logging
 * @returns Payout document
 */
export const getPayoutById = async (payoutId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting payout with ID: ${payoutId}`);

  // Validate payout ID
  if (!mongoose.Types.ObjectId.isValid(payoutId)) {
    throw new ApiError("Invalid payout ID", 400);
  }

  try {
    const payout = await Payout.findById(payoutId).populate("vendor", "businessName email");

    if (!payout) {
      throw new ApiError("Payout not found", 404);
    }

    return payout;
  } catch (error: any) {
    logger.error(`Error getting payout: ${error.message}`);
    throw error;
  }
};
