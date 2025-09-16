import mongoose from "mongoose";
import Country, { type ICountry } from "../models/country.model";
import { createRequestLogger } from "../config/logger";
import { ApiError } from "../utils/api-error";
import { getCache, setCache } from "../config/redis";

// Cache TTL in seconds
const CACHE_TTL = {
  COUNTRIES: 86400, // 24 hours
};

/**
 * Get all countries
 * @param requestId Request ID for logging
 * @returns Array of countries
 */
export const getAllCountries = async (requestId?: string): Promise<ICountry[]> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting all countries");

  // Try to get from cache
  const cacheKey = "countries:all";
  const cachedData = await getCache<ICountry[]>(cacheKey);

  if (cachedData) {
    logger.info("Retrieved countries from cache");
    return cachedData;
  }

  try {
    const countries = await Country.find({ isActive: true })
      .sort({ name: 1 })
      .populate("currency")
      .lean();

    // Cache the results
    await setCache(cacheKey, countries, CACHE_TTL.COUNTRIES);

    return countries;
  } catch (error) {
    logger.error(`Error getting countries: ${error.message}`);
    throw new ApiError(`Failed to get countries: ${error.message}`, 500);
  }
};

/**
 * Get country by code
 * @param code Country code
 * @param requestId Request ID for logging
 * @returns Country object
 */
export const getCountryByCode = async (code: string, requestId?: string): Promise<ICountry> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting country by code: ${code}`);

  // Try to get from cache
  const cacheKey = `country:${code}`;
  const cachedData = await getCache<ICountry>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved country ${code} from cache`);
    return cachedData;
  }

  try {
    const country = await Country.findOne({ code: code.toUpperCase(), isActive: true })
      .populate("currency")
      .lean();

    if (!country) {
      throw new ApiError(`Country with code ${code} not found`, 404);
    }

    // Cache the results
    await setCache(cacheKey, country, CACHE_TTL.COUNTRIES);

    return country;
  } catch (error) {
    logger.error(`Error getting country by code: ${error.message}`);
    throw error;
  }
};

/**
 * Create country
 * @param countryData Country data
 * @param requestId Request ID for logging
 * @returns Created country
 */
export const createCountry = async (
  countryData: Partial<ICountry>,
  requestId?: string
): Promise<ICountry> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Creating country: ${JSON.stringify(countryData)}`);

  try {
    // Check if country with same code already exists
    const existingCountry = await Country.findOne({ code: countryData.code?.toUpperCase() });

    if (existingCountry) {
      throw new ApiError(`Country with code ${countryData.code} already exists`, 400);
    }

    // Validate currency ID
    if (!mongoose.Types.ObjectId.isValid(countryData.currency as any)) {
      throw new ApiError("Invalid currency ID", 400);
    }

    // Create country
    const country = await Country.create(countryData);

    // Invalidate cache
    await invalidateCountryCache();

    return country;
  } catch (error) {
    logger.error(`Error creating country: ${error.message}`);
    throw error;
  }
};

/**
 * Update country
 * @param code Country code
 * @param countryData Country data
 * @param requestId Request ID for logging
 * @returns Updated country
 */
export const updateCountry = async (
  code: string,
  countryData: Partial<ICountry>,
  requestId?: string
): Promise<ICountry> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating country ${code}: ${JSON.stringify(countryData)}`);

  try {
    // Find country
    const country = await Country.findOne({ code: code.toUpperCase() });

    if (!country) {
      throw new ApiError(`Country with code ${code} not found`, 404);
    }

    // If trying to change the code, check if new code already exists
    if (countryData.code && countryData.code.toUpperCase() !== code.toUpperCase()) {
      const existingCountry = await Country.findOne({ code: countryData.code.toUpperCase() });

      if (existingCountry) {
        throw new ApiError(`Country with code ${countryData.code} already exists`, 400);
      }
    }

    // Validate currency ID if provided
    if (countryData.currency && !mongoose.Types.ObjectId.isValid(countryData.currency as any)) {
      throw new ApiError("Invalid currency ID", 400);
    }

    // Update country
    Object.assign(country, countryData);
    await country.save();

    // Invalidate cache
    await invalidateCountryCache();

    return country;
  } catch (error) {
    logger.error(`Error updating country: ${error.message}`);
    throw error;
  }
};

/**
 * Delete country
 * @param code Country code
 * @param requestId Request ID for logging
 * @returns Deleted country
 */
export const deleteCountry = async (code: string, requestId?: string): Promise<ICountry> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Deleting country: ${code}`);

  try {
    // Find country
    const country = await Country.findOne({ code: code.toUpperCase() });

    if (!country) {
      throw new ApiError(`Country with code ${code} not found`, 404);
    }

    // Check if country is in use
    // This would require checking if any users, orders, etc. are using this country
    // For simplicity, we'll skip this check for now

    // Delete country
    await country.remove();

    // Invalidate cache
    await invalidateCountryCache();

    return country;
  } catch (error) {
    logger.error(`Error deleting country: ${error.message}`);
    throw error;
  }
};

/**
 * Get states/provinces for a country
 * @param countryCode Country code
 * @param requestId Request ID for logging
 * @returns Array of states/provinces
 */
export const getStatesByCountry = async (
  countryCode: string,
  requestId?: string
): Promise<{ code: string; name: string }[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting states for country: ${countryCode}`);

  // Try to get from cache
  const cacheKey = `country:${countryCode}:states`;
  const cachedData = await getCache<{ code: string; name: string }[]>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved states for country ${countryCode} from cache`);
    return cachedData;
  }

  try {
    const country = await Country.findOne({ code: countryCode.toUpperCase(), isActive: true })
      .select("states")
      .lean();

    if (!country) {
      throw new ApiError(`Country with code ${countryCode} not found`, 404);
    }

    const states = country.states || [];

    // Cache the results
    await setCache(cacheKey, states, CACHE_TTL.COUNTRIES);

    return states;
  } catch (error) {
    logger.error(`Error getting states for country: ${error.message}`);
    throw error;
  }
};

/**
 * Invalidate country cache
 */
const invalidateCountryCache = async (): Promise<void> => {
  const logger = createRequestLogger();
  logger.info("Invalidating country cache");

  try {
    // Delete all country-related cache keys
    await Promise.all([
      getCache("countries:all").then((data) => {
        if (data) return setCache("countries:all", null, 1);
      }),
    ]);

    // Delete individual country cache keys
    const countries = await Country.find().select("code").lean();
    await Promise.all(
      countries.map((country) =>
        getCache(`country:${country.code}`).then((data) => {
          if (data) return setCache(`country:${country.code}`, null, 1);
        })
      )
    );

    // Delete states cache keys
    await Promise.all(
      countries.map((country) =>
        getCache(`country:${country.code}:states`).then((data) => {
          if (data) return setCache(`country:${country.code}:states`, null, 1);
        })
      )
    );

    logger.info("Country cache invalidated");
  } catch (error) {
    logger.error(`Error invalidating country cache: ${error.message}`);
  }
};
