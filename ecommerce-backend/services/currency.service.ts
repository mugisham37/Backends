import mongoose from "mongoose";
import Currency, { type ICurrency } from "../models/currency.model";
import { createRequestLogger } from "../config/logger";
import { ApiError } from "../utils/api-error";
import { getCache, setCache } from "../config/redis";
import axios from "axios";

// Cache TTL in seconds
const CACHE_TTL = {
  CURRENCIES: 3600, // 1 hour
  EXCHANGE_RATES: 3600, // 1 hour
};

/**
 * Get all currencies
 * @param requestId Request ID for logging
 * @returns Array of currencies
 */
export const getAllCurrencies = async (requestId?: string): Promise<ICurrency[]> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting all currencies");

  // Try to get from cache
  const cacheKey = "currencies:all";
  const cachedData = await getCache<ICurrency[]>(cacheKey);

  if (cachedData) {
    logger.info("Retrieved currencies from cache");
    return cachedData;
  }

  try {
    const currencies = await Currency.find({ isActive: true }).sort({ code: 1 }).lean();

    // Cache the results
    await setCache(cacheKey, currencies, CACHE_TTL.CURRENCIES);

    return currencies;
  } catch (error) {
    logger.error(`Error getting currencies: ${error.message}`);
    throw new ApiError(`Failed to get currencies: ${error.message}`, 500);
  }
};

/**
 * Get currency by code
 * @param code Currency code
 * @param requestId Request ID for logging
 * @returns Currency object
 */
export const getCurrencyByCode = async (code: string, requestId?: string): Promise<ICurrency> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting currency by code: ${code}`);

  // Try to get from cache
  const cacheKey = `currency:${code}`;
  const cachedData = await getCache<ICurrency>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved currency ${code} from cache`);
    return cachedData;
  }

  try {
    const currency = await Currency.findOne({ code: code.toUpperCase(), isActive: true }).lean();

    if (!currency) {
      throw new ApiError(`Currency with code ${code} not found`, 404);
    }

    // Cache the results
    await setCache(cacheKey, currency, CACHE_TTL.CURRENCIES);

    return currency;
  } catch (error) {
    logger.error(`Error getting currency by code: ${error.message}`);
    throw error;
  }
};

/**
 * Get base currency
 * @param requestId Request ID for logging
 * @returns Base currency object
 */
export const getBaseCurrency = async (requestId?: string): Promise<ICurrency> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting base currency");

  // Try to get from cache
  const cacheKey = "currency:base";
  const cachedData = await getCache<ICurrency>(cacheKey);

  if (cachedData) {
    logger.info("Retrieved base currency from cache");
    return cachedData;
  }

  try {
    const baseCurrency = await Currency.findOne({ isBase: true }).lean();

    if (!baseCurrency) {
      throw new ApiError("No base currency found", 500);
    }

    // Cache the results
    await setCache(cacheKey, baseCurrency, CACHE_TTL.CURRENCIES);

    return baseCurrency;
  } catch (error) {
    logger.error(`Error getting base currency: ${error.message}`);
    throw error;
  }
};

/**
 * Create currency
 * @param currencyData Currency data
 * @param requestId Request ID for logging
 * @returns Created currency
 */
export const createCurrency = async (
  currencyData: Partial<ICurrency>,
  requestId?: string
): Promise<ICurrency> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Creating currency: ${JSON.stringify(currencyData)}`);

  try {
    // Check if currency with same code already exists
    const existingCurrency = await Currency.findOne({ code: currencyData.code?.toUpperCase() });

    if (existingCurrency) {
      throw new ApiError(`Currency with code ${currencyData.code} already exists`, 400);
    }

    // If this is the first currency, set it as base
    const currencyCount = await Currency.countDocuments();
    if (currencyCount === 0) {
      currencyData.isBase = true;
      currencyData.rate = 1;
    }

    // Create currency
    const currency = await Currency.create(currencyData);

    // Invalidate cache
    await invalidateCurrencyCache();

    return currency;
  } catch (error) {
    logger.error(`Error creating currency: ${error.message}`);
    throw error;
  }
};

/**
 * Update currency
 * @param code Currency code
 * @param currencyData Currency data
 * @param requestId Request ID for logging
 * @returns Updated currency
 */
export const updateCurrency = async (
  code: string,
  currencyData: Partial<ICurrency>,
  requestId?: string
): Promise<ICurrency> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating currency ${code}: ${JSON.stringify(currencyData)}`);

  try {
    // Find currency
    const currency = await Currency.findOne({ code: code.toUpperCase() });

    if (!currency) {
      throw new ApiError(`Currency with code ${code} not found`, 404);
    }

    // If trying to change the code, check if new code already exists
    if (currencyData.code && currencyData.code.toUpperCase() !== code.toUpperCase()) {
      const existingCurrency = await Currency.findOne({ code: currencyData.code.toUpperCase() });

      if (existingCurrency) {
        throw new ApiError(`Currency with code ${currencyData.code} already exists`, 400);
      }
    }

    // If this is the base currency, don't allow changing the rate
    if (currency.isBase && currencyData.rate && currencyData.rate !== 1) {
      throw new ApiError("Cannot change the rate of the base currency", 400);
    }

    // Update currency
    Object.assign(currency, currencyData);
    await currency.save();

    // Invalidate cache
    await invalidateCurrencyCache();

    return currency;
  } catch (error) {
    logger.error(`Error updating currency: ${error.message}`);
    throw error;
  }
};

/**
 * Delete currency
 * @param code Currency code
 * @param requestId Request ID for logging
 * @returns Deleted currency
 */
export const deleteCurrency = async (code: string, requestId?: string): Promise<ICurrency> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Deleting currency: ${code}`);

  try {
    // Find currency
    const currency = await Currency.findOne({ code: code.toUpperCase() });

    if (!currency) {
      throw new ApiError(`Currency with code ${code} not found`, 404);
    }

    // Check if this is the base currency
    if (currency.isBase) {
      throw new ApiError("Cannot delete the base currency", 400);
    }

    // Check if currency is in use
    // This would require checking if any products, orders, etc. are using this currency
    // For simplicity, we'll skip this check for now

    // Delete currency
    await currency.remove();

    // Invalidate cache
    await invalidateCurrencyCache();

    return currency;
  } catch (error) {
    logger.error(`Error deleting currency: ${error.message}`);
    throw error;
  }
};

/**
 * Set base currency
 * @param code Currency code
 * @param requestId Request ID for logging
 * @returns Base currency
 */
export const setBaseCurrency = async (code: string, requestId?: string): Promise<ICurrency> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Setting base currency: ${code}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find currency
    const currency = await Currency.findOne({ code: code.toUpperCase() }).session(session);

    if (!currency) {
      throw new ApiError(`Currency with code ${code} not found`, 404);
    }

    // If already base currency, return
    if (currency.isBase) {
      await session.abortTransaction();
      session.endSession();
      return currency;
    }

    // Find current base currency
    const currentBase = await Currency.findOne({ isBase: true }).session(session);

    // Update all currencies to use the new base currency as reference
    if (currentBase) {
      // Get all currencies
      const currencies = await Currency.find({ _id: { $ne: currency._id } }).session(session);

      // Update rates relative to new base
      for (const curr of currencies) {
        if (curr._id.toString() === currentBase._id.toString()) {
          // Current base becomes regular currency with rate relative to new base
          curr.rate = 1 / currency.rate;
          curr.isBase = false;
        } else {
          // Other currencies get their rates adjusted relative to new base
          curr.rate = curr.rate / currency.rate;
        }
        await curr.save({ session });
      }
    }

    // Set new base currency
    currency.isBase = true;
    currency.rate = 1;
    await currency.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Invalidate cache
    await invalidateCurrencyCache();

    return currency;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Error setting base currency: ${error.message}`);
    throw error;
  }
};

/**
 * Update exchange rates from external API
 * @param apiKey Exchange rate API key
 * @param requestId Request ID for logging
 * @returns Updated currencies
 */
export const updateExchangeRates = async (
  apiKey: string,
  requestId?: string
): Promise<ICurrency[]> => {
  const logger = createRequestLogger(requestId);
  logger.info("Updating exchange rates from external API");

  try {
    // Get base currency
    const baseCurrency = await getBaseCurrency(requestId);

    // Fetch exchange rates from external API
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency.code}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data || !response.data.rates) {
      throw new ApiError("Failed to fetch exchange rates", 500);
    }

    const rates = response.data.rates;

    // Update currencies with new rates
    const currencies = await Currency.find({ isBase: false });

    for (const currency of currencies) {
      if (rates[currency.code]) {
        currency.rate = rates[currency.code];
        await currency.save();
        logger.info(`Updated rate for ${currency.code}: ${currency.rate}`);
      } else {
        logger.warn(`No rate found for ${currency.code}`);
      }
    }

    // Invalidate cache
    await invalidateCurrencyCache();

    return await Currency.find().sort({ code: 1 });
  } catch (error) {
    logger.error(`Error updating exchange rates: ${error.message}`);
    throw new ApiError(`Failed to update exchange rates: ${error.message}`, 500);
  }
};

/**
 * Convert amount between currencies
 * @param amount Amount to convert
 * @param fromCurrency Source currency code
 * @param toCurrency Target currency code
 * @param requestId Request ID for logging
 * @returns Converted amount
 */
export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  requestId?: string
): Promise<number> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Converting ${amount} from ${fromCurrency} to ${toCurrency}`);

  try {
    // If same currency, return amount
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return amount;
    }

    // Get currencies
    const sourceCurrency = await getCurrencyByCode(fromCurrency, requestId);
    const targetCurrency = await getCurrencyByCode(toCurrency, requestId);

    // Convert to base currency first, then to target currency
    const amountInBaseCurrency = amount / sourceCurrency.rate;
    const convertedAmount = amountInBaseCurrency * targetCurrency.rate;

    // Round to target currency decimal places
    const factor = Math.pow(10, targetCurrency.decimalPlaces);
    return Math.round(convertedAmount * factor) / factor;
  } catch (error) {
    logger.error(`Error converting currency: ${error.message}`);
    throw error;
  }
};

/**
 * Format amount according to currency
 * @param amount Amount to format
 * @param currencyCode Currency code
 * @param requestId Request ID for logging
 * @returns Formatted amount string
 */
export const formatCurrency = async (
  amount: number,
  currencyCode: string,
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Formatting ${amount} in ${currencyCode}`);

  try {
    const currency = await getCurrencyByCode(currencyCode, requestId);

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces,
    }).format(amount);
  } catch (error) {
    logger.error(`Error formatting currency: ${error.message}`);
    throw error;
  }
};

/**
 * Invalidate currency cache
 */
const invalidateCurrencyCache = async (): Promise<void> => {
  const logger = createRequestLogger();
  logger.info("Invalidating currency cache");

  try {
    // Delete all currency-related cache keys
    await Promise.all([
      getCache("currencies:all").then((data) => {
        if (data) return setCache("currencies:all", null, 1);
      }),
      getCache("currency:base").then((data) => {
        if (data) return setCache("currency:base", null, 1);
      }),
    ]);

    // Delete individual currency cache keys
    const currencies = await Currency.find().select("code").lean();
    await Promise.all(
      currencies.map((currency) =>
        getCache(`currency:${currency.code}`).then((data) => {
          if (data) return setCache(`currency:${currency.code}`, null, 1);
        })
      )
    );

    logger.info("Currency cache invalidated");
  } catch (error) {
    logger.error(`Error invalidating currency cache: ${error.message}`);
  }
};
