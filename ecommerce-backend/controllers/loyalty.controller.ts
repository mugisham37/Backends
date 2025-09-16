import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { ApiError } from "../utils/api-error"
import { createRequestLogger } from "../config/logger"
import * as loyaltyService from "../services/loyalty.service"
import { translateError } from "../utils/translate"

/**
 * Get customer loyalty program
 * @route GET /api/v1/loyalty
 * @access Protected
 */
export const getCustomerLoyaltyProgram = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id

  requestLogger.info(`Getting loyalty program for user ID: ${userId}`)

  const loyaltyProgram = await loyaltyService.getCustomerLoyaltyProgram(userId.toString(), req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      loyaltyProgram,
    },
  })
})

/**
 * Get loyalty program tiers
 * @route GET /api/v1/loyalty/tiers
 * @access Public
 */
export const getLoyaltyTiers = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting loyalty program tiers")

  const tiers = await loyaltyService.getLoyaltyTiers(req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: tiers.length,
    data: {
      tiers,
    },
  })
})

/**
 * Get available rewards
 * @route GET /api/v1/loyalty/rewards
 * @access Protected
 */
export const getAvailableRewards = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id

  requestLogger.info(`Getting available rewards for user ID: ${userId}`)

  const rewards = await loyaltyService.getAvailableRewards(userId.toString(), req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: rewards.length,
    data: {
      rewards,
    },
  })
})

/**
 * Get customer loyalty history
 * @route GET /api/v1/loyalty/history
 * @access Protected
 */
export const getLoyaltyHistory = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-createdAt"

  requestLogger.info(`Getting loyalty history for user ID: ${userId}`)

  const { history, count } = await loyaltyService.getLoyaltyHistory(userId.toString(), { page, limit, sort }, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: history.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      history,
    },
  })
})

/**
 * Redeem reward
 * @route POST /api/v1/loyalty/redeem
 * @access Protected
 */
export const redeemReward = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const { rewardId } = req.body

  if (!rewardId) {
    return next(new ApiError(translateError("rewardIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Redeeming reward ID: ${rewardId} for user ID: ${userId}`)

  const redemption = await loyaltyService.redeemReward(userId.toString(), rewardId, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      redemption,
    },
  })
})

/**
 * Get reward by ID
 * @route GET /api/v1/loyalty/rewards/:id
 * @access Protected
 */
export const getRewardById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  if (!id) {
    return next(new ApiError(translateError("rewardIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Getting reward with ID: ${id}`)

  const reward = await loyaltyService.getRewardById(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      reward,
    },
  })
})

/**
 * Get redemption by ID
 * @route GET /api/v1/loyalty/redemptions/:id
 * @access Protected
 */
export const getRedemptionById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const { id } = req.params

  if (!id) {
    return next(new ApiError(translateError("redemptionIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Getting redemption with ID: ${id} for user ID: ${userId}`)

  const redemption = await loyaltyService.getRedemptionById(id, userId.toString(), req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      redemption,
    },
  })
})

/**
 * Get customer redemptions
 * @route GET /api/v1/loyalty/redemptions
 * @access Protected
 */
export const getCustomerRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-createdAt"

  requestLogger.info(`Getting redemptions for user ID: ${userId}`)

  const { redemptions, count } = await loyaltyService.getCustomerRedemptions(
    userId.toString(),
    { page, limit, sort },
    req.id,
  )

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: redemptions.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      redemptions,
    },
  })
})

/**
 * Get referral code
 * @route GET /api/v1/loyalty/referral
 * @access Protected
 */
export const getReferralCode = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id

  requestLogger.info(`Getting referral code for user ID: ${userId}`)

  const referral = await loyaltyService.getReferralCode(userId.toString(), req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      referral,
    },
  })
})

/**
 * Apply referral code
 * @route POST /api/v1/loyalty/referral/apply
 * @access Protected
 */
export const applyReferralCode = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const userId = req.user._id
  const { referralCode } = req.body

  if (!referralCode) {
    return next(new ApiError(translateError("referralCodeRequired", {}, req.language), 400))
  }

  requestLogger.info(`Applying referral code: ${referralCode} for user ID: ${userId}`)

  const result = await loyaltyService.applyReferralCode(userId.toString(), referralCode, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      result,
    },
  })
})

// Admin controllers

/**
 * Create loyalty tier
 * @route POST /api/v1/admin/loyalty/tiers
 * @access Protected (Admin)
 */
export const createLoyaltyTier = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Creating loyalty tier")

  const tier = await loyaltyService.createLoyaltyTier(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      tier,
    },
  })
})

/**
 * Update loyalty tier
 * @route PUT /api/v1/admin/loyalty/tiers/:id
 * @access Protected (Admin)
 */
export const updateLoyaltyTier = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  if (!id) {
    return next(new ApiError(translateError("tierIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Updating loyalty tier with ID: ${id}`)

  const tier = await loyaltyService.updateLoyaltyTier(id, req.body, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      tier,
    },
  })
})

/**
 * Delete loyalty tier
 * @route DELETE /api/v1/admin/loyalty/tiers/:id
 * @access Protected (Admin)
 */
export const deleteLoyaltyTier = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  if (!id) {
    return next(new ApiError(translateError("tierIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Deleting loyalty tier with ID: ${id}`)

  const tier = await loyaltyService.deleteLoyaltyTier(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      tier,
    },
  })
})

/**
 * Create reward
 * @route POST /api/v1/admin/loyalty/rewards
 * @access Protected (Admin)
 */
export const createReward = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Creating reward")

  const reward = await loyaltyService.createReward(req.body, req.id)

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: {
      reward,
    },
  })
})

/**
 * Update reward
 * @route PUT /api/v1/admin/loyalty/rewards/:id
 * @access Protected (Admin)
 */
export const updateReward = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  if (!id) {
    return next(new ApiError(translateError("rewardIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Updating reward with ID: ${id}`)

  const reward = await loyaltyService.updateReward(id, req.body, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      reward,
    },
  })
})

/**
 * Delete reward
 * @route DELETE /api/v1/admin/loyalty/rewards/:id
 * @access Protected (Admin)
 */
export const deleteReward = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params

  if (!id) {
    return next(new ApiError(translateError("rewardIdRequired", {}, req.language), 400))
  }

  requestLogger.info(`Deleting reward with ID: ${id}`)

  const reward = await loyaltyService.deleteReward(id, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      reward,
    },
  })
})

/**
 * Get all loyalty programs
 * @route GET /api/v1/admin/loyalty/programs
 * @access Protected (Admin)
 */
export const getAllLoyaltyPrograms = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting all loyalty programs")

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-points"

  // Build filter
  const filter: Record<string, any> = {}

  if (req.query.tier) {
    filter.tier = req.query.tier
  }

  if (req.query.minPoints) {
    filter.points = { $gte: Number.parseInt(req.query.minPoints as string, 10) }
  }

  if (req.query.maxPoints) {
    filter.points = { ...filter.points, $lte: Number.parseInt(req.query.maxPoints as string, 10) }
  }

  if (req.query.search) {
    filter.$text = { $search: req.query.search as string }
  }

  const { programs, count } = await loyaltyService.getAllLoyaltyPrograms(filter, { page, limit, sort }, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: programs.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      programs,
    },
  })
})

/**
 * Get all redemptions
 * @route GET /api/v1/admin/loyalty/redemptions
 * @access Protected (Admin)
 */
export const getAllRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting all redemptions")

  // Parse query parameters
  const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : 1
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10
  const sort = (req.query.sort as string) || "-createdAt"

  // Build filter
  const filter: Record<string, any> = {}

  if (req.query.status) {
    filter.status = req.query.status
  }

  if (req.query.reward) {
    filter.reward = req.query.reward
  }

  if (req.query.startDate && req.query.endDate) {
    filter.createdAt = {
      $gte: new Date(req.query.startDate as string),
      $lte: new Date(req.query.endDate as string),
    }
  }

  const { redemptions, count } = await loyaltyService.getAllRedemptions(filter, { page, limit, sort }, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: redemptions.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    },
    data: {
      redemptions,
    },
  })
})

/**
 * Update redemption status
 * @route PATCH /api/v1/admin/loyalty/redemptions/:id/status
 * @access Protected (Admin)
 */
export const updateRedemptionStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { id } = req.params
  const { status, notes } = req.body

  if (!id) {
    return next(new ApiError(translateError("redemptionIdRequired", {}, req.language), 400))
  }

  if (!status) {
    return next(new ApiError(translateError("statusRequired", {}, req.language), 400))
  }

  requestLogger.info(`Updating redemption status for ID: ${id} to ${status}`)

  const redemption = await loyaltyService.updateRedemptionStatus(id, status, notes, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      redemption,
    },
  })
})

/**
 * Manually adjust customer points
 * @route POST /api/v1/admin/loyalty/adjust-points
 * @access Protected (Admin)
 */
export const adjustCustomerPoints = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id)
  const { userId, points, reason } = req.body

  if (!userId) {
    return next(new ApiError(translateError("userIdRequired", {}, req.language), 400))
  }

  if (points === undefined) {
    return next(new ApiError(translateError("pointsRequired", {}, req.language), 400))
  }

  requestLogger.info(`Adjusting points for user ID: ${userId} by ${points}`)

  const result = await loyaltyService.adjustCustomerPoints(userId, points, reason, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      result,
    },
  })
})

/**
 * Get loyalty program statistics
 * @route GET /api/v1/admin/loyalty/statistics
 * @access Protected (Admin)
 */
export const getLoyaltyStatistics = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Getting loyalty program statistics")

  const statistics = await loyaltyService.getLoyaltyStatistics(req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      statistics,
    },
  })
})
