import mongoose from "mongoose";
import TaxRate, { type ITaxRate } from "../models/tax.model";
import { createRequestLogger } from "../config/logger";
import { ApiError } from "../utils/api-error";
import { getCache, setCache } from "../config/redis";

// Cache TTL in seconds
const CACHE_TTL = {
  TAX_RATES: 3600, // 1 hour
};

/**
 * Get all tax rates
 * @param requestId Request ID for logging
 * @returns Array of tax rates
 */
export const getAllTaxRates = async (requestId?: string): Promise<ITaxRate[]> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting all tax rates");

  // Try to get from cache
  const cacheKey = "tax:all";
  const cachedData = await getCache<ITaxRate[]>(cacheKey);

  if (cachedData) {
    logger.info("Retrieved tax rates from cache");
    return cachedData;
  }

  try {
    const taxRates = await TaxRate.find({ isActive: true })
      .sort({ country: 1, priority: -1 })
      .lean();

    // Cache the results
    await setCache(cacheKey, taxRates, CACHE_TTL.TAX_RATES);

    return taxRates;
  } catch (error) {
    logger.error(`Error getting tax rates: ${error.message}`);
    throw new ApiError(`Failed to get tax rates: ${error.message}`, 500);
  }
};

/**
 * Get tax rate by ID
 * @param id Tax rate ID
 * @param requestId Request ID for logging
 * @returns Tax rate object
 */
export const getTaxRateById = async (id: string, requestId?: string): Promise<ITaxRate> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting tax rate by ID: ${id}`);

  // Validate ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid tax rate ID", 400);
  }

  // Try to get from cache
  const cacheKey = `tax:${id}`;
  const cachedData = await getCache<ITaxRate>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved tax rate ${id} from cache`);
    return cachedData;
  }

  try {
    const taxRate = await TaxRate.findById(id).lean();

    if (!taxRate) {
      throw new ApiError(`Tax rate with ID ${id} not found`, 404);
    }

    // Cache the results
    await setCache(cacheKey, taxRate, CACHE_TTL.TAX_RATES);

    return taxRate;
  } catch (error) {
    logger.error(`Error getting tax rate by ID: ${error.message}`);
    throw error;
  }
};

/**
 * Create tax rate
 * @param taxRateData Tax rate data
 * @param requestId Request ID for logging
 * @returns Created tax rate
 */
export const createTaxRate = async (
  taxRateData: Partial<ITaxRate>,
  requestId?: string
): Promise<ITaxRate> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Creating tax rate: ${JSON.stringify(taxRateData)}`);

  try {
    // Create tax rate
    const taxRate = await TaxRate.create(taxRateData);

    // Invalidate cache
    await invalidateTaxCache();

    return taxRate;
  } catch (error) {
    logger.error(`Error creating tax rate: ${error.message}`);
    throw error;
  }
};

/**
 * Update tax rate
 * @param id Tax rate ID
 * @param taxRateData Tax rate data
 * @param requestId Request ID for logging
 * @returns Updated tax rate
 */
export const updateTaxRate = async (
  id: string,
  taxRateData: Partial<ITaxRate>,
  requestId?: string
): Promise<ITaxRate> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating tax rate ${id}: ${JSON.stringify(taxRateData)}`);

  // Validate ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid tax rate ID", 400);
  }

  try {
    // Find tax rate
    const taxRate = await TaxRate.findById(id);

    if (!taxRate) {
      throw new ApiError(`Tax rate with ID ${id} not found`, 404);
    }

    // Update tax rate
    Object.assign(taxRate, taxRateData);
    await taxRate.save();

    // Invalidate cache
    await invalidateTaxCache();

    return taxRate;
  } catch (error) {
    logger.error(`Error updating tax rate: ${error.message}`);
    throw error;
  }
};

/**
 * Delete tax rate
 * @param id Tax rate ID
 * @param requestId Request ID for logging
 * @returns Deleted tax rate
 */
export const deleteTaxRate = async (id: string, requestId?: string): Promise<ITaxRate> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Deleting tax rate: ${id}`);

  // Validate ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid tax rate ID", 400);
  }

  try {
    // Find tax rate
    const taxRate = await TaxRate.findById(id);

    if (!taxRate) {
      throw new ApiError(`Tax rate with ID ${id} not found`, 404);
    }

    // Delete tax rate
    await taxRate.remove();

    // Invalidate cache
    await invalidateTaxCache();

    return taxRate;
  } catch (error) {
    logger.error(`Error deleting tax rate: ${error.message}`);
    throw error;
  }
};

/**
 * Get applicable tax rate for a location
 * @param country Country code
 * @param state State/province code (optional)
 * @param postalCode Postal/ZIP code (optional)
 * @param categoryId Product category ID (optional)
 * @param requestId Request ID for logging
 * @returns Applicable tax rate
 */
export const getApplicableTaxRate = async (
  country: string,
  state?: string,
  postalCode?: string,
  categoryId?: string,
  requestId?: string
): Promise<ITaxRate> => {
  const logger = createRequestLogger(requestId);
  logger.info(
    `Getting applicable tax rate for ${country}, ${state || "any"}, ${postalCode || "any"}`
  );

  // Try to get from cache
  const cacheKey = `tax:applicable:${country}:${state || "any"}:${postalCode || "any"}:${categoryId || "any"}`;
  const cachedData = await getCache<ITaxRate>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved applicable tax rate from cache`);
    return cachedData;
  }

  try {
    // Build query to find the most specific tax rate
    const query: any = {
      country: country.toUpperCase(),
      isActive: true,
    };

    // If state is provided, include it in the query
    if (state) {
      query.state = state.toUpperCase();
    }

    // If postal code is provided, include it in the query
    if (postalCode) {
      query.postalCode = postalCode;
    }

    // If category ID is provided, include it in the query
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      query.productCategories = { $in: [categoryId] };
    }

    // Find tax rates matching the criteria, sorted by priority
    let taxRates = await TaxRate.find(query).sort({ priority: -1 }).limit(1).lean();

    // If no specific tax rate found, try without postal code
    if (!taxRates.length && postalCode) {
      delete query.postalCode;
      taxRates = await TaxRate.find(query).sort({ priority: -1 }).limit(1).lean();
    }

    // If still no tax rate found, try without state
    if (!taxRates.length && state) {
      delete query.state;
      taxRates = await TaxRate.find(query).sort({ priority: -1 }).limit(1).lean();
    }

    // If still no tax rate found, try without category
    if (!taxRates.length && categoryId) {
      delete query.productCategories;
      taxRates = await TaxRate.find(query).sort({ priority: -1 }).limit(1).lean();
    }

    // If still no tax rate found, get the default tax rate
    if (!taxRates.length) {
      taxRates = await TaxRate.find({ isDefault: true, isActive: true }).limit(1).lean();
    }

    // If no tax rate found at all, return zero tax rate
    if (!taxRates.length) {
      logger.warn("No applicable tax rate found, returning zero tax");
      return {
        _id: "default",
        name: "No Tax",
        rate: 0,
        country: "GLOBAL",
        isDefault: true,
        isActive: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }

    const applicableTaxRate = taxRates[0];

    // Cache the results
    await setCache(cacheKey, applicableTaxRate, CACHE_TTL.TAX_RATES);

    return applicableTaxRate;
  } catch (error) {
    logger.error(`Error getting applicable tax rate: ${error.message}`);
    throw new ApiError(`Failed to get applicable tax rate: ${error.message}`, 500);
  }
};

/**
 * Calculate tax amount
 * @param amount Amount to calculate tax on
 * @param country Country code
 * @param state State/province code (optional)
 * @param postalCode Postal/ZIP code (optional)
 * @param categoryId Product category ID (optional)
 * @param requestId Request ID for logging
 * @returns Tax amount and details
 */
export const calculateTax = async (
  amount: number,
  country: string,
  state?: string,
  postalCode?: string,
  categoryId?: string,
  requestId?: string
): Promise<{ taxAmount: number; taxRate: number; taxName: string; taxRateId: string }> => {
  const logger = createRequestLogger(requestId);
  logger.info(
    `Calculating tax for amount ${amount} in ${country}, ${state || "any"}, ${postalCode || "any"}`
  );

  try {
    const taxRate = await getApplicableTaxRate(country, state, postalCode, categoryId, requestId);

    const taxAmount = (amount * taxRate.rate) / 100;
    const roundedTaxAmount = Math.round(taxAmount * 100) / 100; // Round to 2 decimal places

    return {
      taxAmount: roundedTaxAmount,
      taxRate: taxRate.rate,
      taxName: taxRate.name,
      taxRateId: taxRate._id.toString(),
    };
  } catch (error) {
    logger.error(`Error calculating tax: ${error.message}`);
    throw error;
  }
};

/**
 * Invalidate tax cache
 */
const invalidateTaxCache = async (): Promise<void> => {
  const logger = createRequestLogger();
  logger.info("Invalidating tax cache");

  try {
    // Delete all tax-related cache keys
    await Promise.all([
      getCache("tax:all").then((data) => {
        if (data) return setCache("tax:all", null, 1);
      }),
    ]);

    // Delete individual tax rate cache keys
    const taxRates = await TaxRate.find().select("_id").lean();
    await Promise.all(
      taxRates.map((taxRate) =>
        getCache(`tax:${taxRate._id}`).then((data) => {
          if (data) return setCache(`tax:${taxRate._id}`, null, 1);
        })
      )
    );

    // Delete applicable tax rate cache keys
    // This is more complex as we don't know all possible combinations
    // For simplicity, we'll rely on TTL expiration for these

    logger.info("Tax cache invalidated");
  } catch (error) {
    logger.error(`Error invalidating tax cache: ${error.message}`);
  }
};
