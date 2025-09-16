import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { createRequestLogger } from "../../utils/logger";
import { loyaltyService } from "../../services/loyalty.service";
import { LoyaltyTier } from "../../models/loyaltyTier.model";
import { Reward } from "../../models/reward.model";

// Add this to the existing admin dashboard controller or create a new file

/**
 * Get loyalty program dashboard
 * @route GET /api/v1/admin/dashboard/loyalty
 * @access Protected (Admin)
 */
export const getLoyaltyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Getting loyalty program dashboard");

  // Get loyalty statistics
  const statistics = await loyaltyService.getLoyaltyStatistics(req.id);

  // Get recent redemptions
  const { redemptions } = await loyaltyService.getAllRedemptions(
    {},
    { page: 1, limit: 10, sort: "-createdAt" },
    req.id
  );

  // Get top tiers by user count
  const tiers = await LoyaltyTier.aggregate([
    {
      $lookup: {
        from: "loyaltyprograms",
        localField: "_id",
        foreignField: "tier",
        as: "users",
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        level: 1,
        pointsThreshold: 1,
        userCount: { $size: "$users" },
      },
    },
    {
      $sort: { userCount: -1 },
    },
  ]);

  // Get top rewards by redemption count
  const rewards = await Reward.find().sort("-redemptionCount").limit(10).lean();

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      statistics,
      redemptions,
      tiers,
      rewards,
    },
  });
});
