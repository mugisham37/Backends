import mongoose from "mongoose"
import { createRequestLogger } from "../config/logger"
import { getCache, setCache } from "../config/redis"
import { ApiError } from "../utils/api-error"

// Define settings schema
const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    group: {
      type: String,
      trim: true,
      default: "general",
    },
  },
  {
    timestamps: true,
  },
)

// Create model
const Settings = mongoose.model("Settings", settingsSchema)

// Cache TTL in seconds
const CACHE_TTL = 3600 // 1 hour

/**
 * Get setting by key
 * @param key Setting key
 * @param defaultValue Default value if setting not found
 * @param requestId Request ID for logging
 * @returns Setting value
 */ \
export const getSetting = async <T>(key: string, defaultValue: T, requestId?: string)
: Promise<T> =>
{
  const logger = createRequestLogger(requestId)
  logger.info(`Getting setting: ${key}`)

  // Try to get from cache
  const cacheKey = `setting:${key}`
  const cachedValue = await getCache<T>(cacheKey)

  if (cachedValue !== null) {
    logger.info(`Retrieved setting from cache: ${key}`)
    return cachedValue
  }

  try {
    // Get setting from database
    const setting = await Settings.findOne({ key })

    if (!setting) {
      logger.info(`Setting not found, using default value: ${key}`)
      return defaultValue
    }

    // Cache setting
    await setCache(cacheKey, setting.value, CACHE_TTL)

    return setting.value as T
  } catch (error) {
    logger.error(`Error getting setting: ${error.message}`)
    return defaultValue
  }
}

/**
 * Set setting
 * @param key Setting key
 * @param value Setting value
 * @param description Setting description
 * @param group Setting group
 * @param requestId Request ID for logging
 * @returns Updated setting
 */
export const setSetting = async (
  key: string,
  value: any,
  description?: string,
  group?: string,
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Setting setting: ${key}`)

  try {
    // Update or create setting
    const setting = await Settings.findOneAndUpdate(
      { key },
      {
        value,
        ...(description && { description }),
        ...(group && { group }),
      },
      { upsert: true, new: true },
    )

    // Clear cache
    const cacheKey = `setting:${key}`
    await setCache(cacheKey, null, 1)

    return setting
  } catch (error) {
    logger.error(`Error setting setting: ${error.message}`)
    throw new ApiError(`Failed to set setting: ${error.message}`, 500)
  }
}

/**
 * Get settings by group
 * @param group Setting group
 * @param requestId Request ID for logging
 * @returns Settings in group
 */
export const getSettingsByGroup = async (group: string, requestId?: string): Promise<any[]> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting settings for group: ${group}`)

  // Try to get from cache
  const cacheKey = `settings:group:${group}`
  const cachedSettings = await getCache<any[]>(cacheKey)

  if (cachedSettings) {
    logger.info(`Retrieved settings from cache for group: ${group}`)
    return cachedSettings
  }

  try {
    // Get settings from database
    const settings = await Settings.find({ group }).lean()

    // Cache settings
    await setCache(cacheKey, settings, CACHE_TTL)

    return settings
  } catch (error) {
    logger.error(`Error getting settings by group: ${error.message}`)
    throw new ApiError(`Failed to get settings: ${error.message}`, 500)
  }
}

/**
 * Delete setting
 * @param key Setting key
 * @param requestId Request ID for logging
 * @returns Deleted setting
 */
export const deleteSetting = async (key: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Deleting setting: ${key}`)

  try {
    // Delete setting
    const setting = await Settings.findOneAndDelete({ key })

    if (!setting) {
      throw new ApiError("Setting not found", 404)
    }

    // Clear cache
    const cacheKey = `setting:${key}`
    await setCache(cacheKey, null, 1)

    // Clear group cache if setting has a group
    if (setting.group) {
      const groupCacheKey = `settings:group:${setting.group}`
      await setCache(groupCacheKey, null, 1)
    }

    return setting
  } catch (error) {
    logger.error(`Error deleting setting: ${error.message}`)
    throw error
  }
}

/**
 * Initialize default settings
 * @param requestId Request ID for logging
 */
export const initializeDefaultSettings = async (requestId?: string): Promise<void> => {
  const logger = createRequestLogger(requestId)
  logger.info("Initializing default settings")

  try {
    // Define default settings
    const defaultSettings = [
      {
        key: "loyalty.pointsPerCurrency",
        value: 1,
        description: "Number of loyalty points awarded per currency unit spent",
        group: "loyalty",
      },
      {
        key: "loyalty.pointsExpiryDays",
        value: 365,
        description: "Number of days after which loyalty points expire",
        group: "loyalty",
      },
      {
        key: "loyalty.referralBonus.referrer",
        value: 100,
        description: "Bonus points awarded to the referrer",
        group: "loyalty",
      },
      {
        key: "loyalty.referralBonus.referee",
        value: 50,
        description: "Bonus points awarded to the new user (referee)",
        group: "loyalty",
      },
      {
        key: "loyalty.firstPurchaseBonus",
        value: 100,
        description: "Bonus points awarded for first purchase",
        group: "loyalty",
      },
      {
        key: "loyalty.reviewBonus",
        value: 50,
        description: "Bonus points awarded for writing a review",
        group: "loyalty",
      },
      {
        key: "loyalty.birthdayBonus",
        value: 100,
        description: "Bonus points awarded on user's birthday",
        group: "loyalty",
      },
    ]

    // Create or update default settings
    for (const setting of defaultSettings) {
      // Check if setting exists
      const existingSetting = await Settings.findOne({ key: setting.key })

      if (!existingSetting) {
        // Create setting
        await Settings.create(setting)
        logger.info(`Created default setting: ${setting.key}`)
      }
    }

    logger.info("Default settings initialized")
  } catch (error) {
    logger.error(`Error initializing default settings: ${error.message}`)
  }
}
