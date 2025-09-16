import mongoose from "mongoose"
import { LoyaltyProgram, LoyaltyTier, Redemption, LoyaltyHistory } from "../models/loyalty.model"
import User from "../models/user.model"
import { createRequestLogger } from "../config/logger"
import { getCache, setCache } from "../config/redis"
import { ApiError } from "../utils/api-error"
import crypto from "crypto"
import { getAvailableRewards } from "./reward.service"

// Cache TTL in seconds
const CACHE_TTL = {
  LOYALTY_PROGRAM: 3600, // 1 hour
  LOYALTY_TIERS: 86400, // 24 hours
  AVAILABLE_REWARDS: 1800, // 30 minutes
  REWARD_DETAILS: 3600, // 1 hour
  LOYALTY_STATISTICS: 1800, // 30 minutes
}

/**
 * Generate a unique referral code for a user
 * @param userId User ID
 * @returns Referral code
 */
const generateReferralCode = (userId: string): string => {
  const hash = crypto.createHash("sha256")
  hash.update(userId + Date.now().toString())
  return hash.digest("hex").substring(0, 8).toUpperCase()
}

/**
 * Generate a unique redemption code
 * @returns Redemption code
 */
const generateRedemptionCode = (): string => {
  const hash = crypto.createHash("sha256")
  hash.update(Date.now().toString() + Math.random().toString())
  return hash.digest("hex").substring(0, 12).toUpperCase()
}

/**
 * Get customer loyalty program
 * @param userId User ID
 * @param requestId Request ID for logging
 * @returns Customer loyalty program
 */
export const getCustomerLoyaltyProgram = async (userId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting loyalty program for user ID: ${userId}`)

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError("Invalid user ID", 400)
  }

  // Try to get from cache
  const cacheKey = `loyalty:program:${userId}`
  const cachedProgram = await getCache<any>(cacheKey)

  if (cachedProgram) {
    logger.info(`Retrieved loyalty program from cache for user ID: ${userId}`)
    return cachedProgram
  }

  try {
    // Check if user exists
    const user = await User.findById(userId)
    if (!user) {
      throw new ApiError("User not found", 404)
    }

    // Get or create loyalty program
    let loyaltyProgram = await LoyaltyProgram.findOne({ user: userId }).populate("tier").lean()

    if (!loyaltyProgram) {
      // Create new loyalty program
      const defaultTier = await LoyaltyTier.findOne({ level: 1 })
      if (!defaultTier) {
        throw new ApiError("Default loyalty tier not found", 500)
      }

      const newProgram = await LoyaltyProgram.create({
        user: userId,
        tier: defaultTier._id,
        points: 0,
        lifetimePoints: 0,
        referralCode: generateReferralCode(userId),
      })

      loyaltyProgram = await LoyaltyProgram.findById(newProgram._id).populate("tier").lean()
    }

    // Get next tier if available
    let nextTier = null
    if (loyaltyProgram.tier) {
      nextTier = await LoyaltyTier.findOne({
        level: loyaltyProgram.tier.level + 1,
      }).lean()
    }

    // Calculate points needed for next tier
    const pointsForNextTier = nextTier ? nextTier.pointsThreshold - loyaltyProgram.lifetimePoints : null

    // Get recent history
    const recentHistory = await LoyaltyHistory.find({ user: userId })
      .sort("-createdAt")
      .limit(5)
      .populate("order")
      .lean()

    // Get active redemptions
    const activeRedemptions = await Redemption.find({
      user: userId,
      status: { $in: ["pending", "approved"] },
    })
      .sort("-createdAt")
      .populate("reward")
      .lean()

    // Compile result
    const result = {
      ...loyaltyProgram,
      nextTier,
      pointsForNextTier,
      recentHistory,
      activeRedemptions,
    }

    // Cache the result
    await setCache(cacheKey, result, CACHE_TTL.LOYALTY_PROGRAM)

    return result
  } catch (error) {
    logger.error(`Error getting loyalty program: ${error.message}`)
    throw error
  }
}

// Add this function to the loyalty service for optimized queries

/**
 * Get customer loyalty dashboard
 * @param userId User ID
 * @param requestId Request ID for logging
 * @returns Dashboard data
 */
export const getCustomerLoyaltyDashboard = async (userId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting loyalty dashboard for user ID: ${userId}`)

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError("Invalid user ID", 400)
  }

  try {
    // Execute all queries in parallel for better performance
    const [loyaltyProgram, recentHistory, activeRedemptions, availableRewards, referralStats] = await Promise.all([
      // Get loyalty program
      LoyaltyProgram.findOne({ user: userId })
        .populate("tier")
        .lean(),

      // Get recent history (limited to 5 entries)
      LoyaltyHistory.find({ user: userId })
        .sort("-createdAt")
        .limit(5)
        .populate("order")
        .lean(),

      // Get active redemptions
      Redemption.find({
        user: userId,
        status: { $in: ["pending", "approved"] },
      })
        .sort("-createdAt")
        .limit(5)
        .populate("reward")
        .lean(),

      // Get available rewards (limited to 10)
      getAvailableRewards(userId, requestId).then((rewards) => rewards.slice(0, 10)),

      // Get referral statistics
      LoyaltyProgram.countDocuments({ referredBy: userId }),
    ])

    // If loyalty program doesn't exist, create it
    if (!loyaltyProgram) {
      // This should not happen as getCustomerLoyaltyProgram creates it if it doesn't exist
      throw new ApiError("Loyalty program not found", 404)
    }

    // Get next tier if available
    let nextTier = null
    if (loyaltyProgram.tier) {
      nextTier = await LoyaltyTier.findOne({
        level: loyaltyProgram.tier.level + 1,
      }).lean()
    }

    // Calculate points needed for next tier
    const pointsForNextTier = nextTier ? nextTier.pointsThreshold - loyaltyProgram.lifetimePoints : null

    // Get total redeemed points
    const redeemedPoints = await LoyaltyHistory.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), type: "redemption" } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ])

    // Compile dashboard data
    const dashboard = {
      program: loyaltyProgram,
      nextTier,
      pointsForNextTier,
      recentActivity: recentHistory,
      activeRedemptions,
      availableRewards,
      referralCount: referralStats,
      stats: {
        totalPoints: loyaltyProgram.lifetimePoints,
        availablePoints: loyaltyProgram.points,
        redeemedPoints: redeemedPoints.length > 0 ? Math.abs(redeemedPoints[0].total) : 0,
        tier: loyaltyProgram.tier.name,
        tierLevel: loyaltyProgram.tier.level,
      },
    }

    return dashboard
  } catch (error) {
    logger.error(`Error getting loyalty dashboard: ${error.message}`)
    throw error
  }
}

/**
 * Get loyalty program statistics by time period
 * @param userId User ID
 * @param period Time period (week, month, year, all)
 * @param requestId Request ID for logging
 * @returns Statistics for the period
 */
export const getLoyaltyStatisticsByPeriod = async (
  userId: string,
  period: "week" | "month" | "year" | "all" = "all",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting loyalty statistics for user ID: ${userId} and period: ${period}`)

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError("Invalid user ID", 400)
  }

  try {
    // Calculate start date based on period
    let startDate: Date | null = null
    const now = new Date()

    if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    } else if (period === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    } else if (period === "year") {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // 365 days ago
    }

    // Build match stage
    const matchStage: any = { user: new mongoose.Types.ObjectId(userId) }
    if (startDate) {
      matchStage.createdAt = { $gte: startDate }
    }

    // Get points by type
    const pointsByType = await LoyaltyHistory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$type",
          totalPoints: { $sum: "$points" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalPoints: -1 } },
    ])

    // Get points by day (for charts)
    const pointsByDay = await LoyaltyHistory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          points: { $sum: "$points" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: "$_id.day",
                },
              },
            },
          },
          points: 1,
          count: 1,
        },
      },
    ])

    // Get total points for the period
    const totalPoints = pointsByType.reduce((sum, item) => sum + (item.totalPoints > 0 ? item.totalPoints : 0), 0)

    // Get total redeemed points for the period
    const redeemedPoints = pointsByType.find((item) => item._id === "redemption")
      ? Math.abs(pointsByType.find((item) => item._id === "redemption").totalPoints)
      : 0

    return {
      totalPoints,
      redeemedPoints,
      pointsByType,
      pointsByDay,
      period,
    }
  } catch (error) {
    logger.error(`Error getting loyalty statistics by period: ${error.message}`)
    throw error
  }
}
