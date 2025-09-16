import { LoyaltyProgram, LoyaltyHistory, Redemption } from "../models/loyalty.model";
import { createRequestLogger } from "../config/logger";
import { ApiError } from "../utils/api-error";
import * as exportService from "./export.service";

/**
 * Generate loyalty program report
 * @param options Report options
 * @param requestId Request ID for logging
 * @returns Report file path
 */
export const generateLoyaltyReport = async (
  options: {
    format: "csv" | "excel" | "pdf" | "json";
    type: "points" | "redemptions" | "tiers" | "referrals";
    startDate?: Date;
    endDate?: Date;
    filter?: Record<string, any>;
  },
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Generating loyalty report of type: ${options.type} in format: ${options.format}`);

  try {
    // Set default dates if not provided
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Generate report based on type
    switch (options.type) {
      case "points":
        return generatePointsReport(options.format, startDate, endDate, options.filter, requestId);
      case "redemptions":
        return generateRedemptionsReport(
          options.format,
          startDate,
          endDate,
          options.filter,
          requestId
        );
      case "tiers":
        return generateTiersReport(options.format, options.filter, requestId);
      case "referrals":
        return generateReferralsReport(
          options.format,
          startDate,
          endDate,
          options.filter,
          requestId
        );
      default:
        throw new ApiError(`Invalid report type: ${options.type}`, 400);
    }
  } catch (error) {
    logger.error(`Error generating loyalty report: ${error.message}`);
    throw error;
  }
};

/**
 * Generate points report
 * @param format Export format
 * @param startDate Start date
 * @param endDate End date
 * @param filter Additional filters
 * @param requestId Request ID for logging
 * @returns Report file path
 */
async function generatePointsReport(
  format: "csv" | "excel" | "pdf" | "json",
  startDate: Date,
  endDate: Date,
  filter?: Record<string, any>,
  requestId?: string
): Promise<string> {
  const logger = createRequestLogger(requestId);
  logger.info("Generating points report");

  try {
    // Build query
    const query: Record<string, any> = {
      createdAt: { $gte: startDate, $lte: endDate },
      ...filter,
    };

    // Get points history
    const pointsHistory = await LoyaltyHistory.find(query)
      .populate("user", "firstName lastName email")
      .sort("-createdAt")
      .lean();

    // Format data for export
    const formattedData = pointsHistory.map((entry) => ({
      userId: entry.user._id.toString(),
      userName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "N/A",
      userEmail: entry.user ? entry.user.email : "N/A",
      type: entry.type,
      points: entry.points,
      description: entry.description,
      date: new Date(entry.createdAt).toLocaleString(),
      orderId: entry.order ? entry.order.toString() : "",
      redemptionId: entry.redemption ? entry.redemption.toString() : "",
      referredUserId: entry.referredUser ? entry.referredUser.toString() : "",
    }));

    // Define fields to export
    const fields = [
      "userId",
      "userName",
      "userEmail",
      "type",
      "points",
      "description",
      "date",
      "orderId",
      "redemptionId",
      "referredUserId",
    ];

    // Export data
    switch (format) {
      case "csv":
        return exportService.exportToCsv(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_POINTS,
          requestId
        );
      case "excel":
        return exportService.exportToExcel(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_POINTS,
          requestId
        );
      case "pdf":
        return exportService.exportToPdf(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_POINTS,
          "Loyalty Points Report",
          requestId
        );
      case "json":
        return exportService.exportToJson(
          formattedData,
          exportService.ExportDataType.LOYALTY_POINTS,
          requestId
        );
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error generating points report: ${error.message}`);
    throw error;
  }
}

/**
 * Generate redemptions report
 * @param format Export format
 * @param startDate Start date
 * @param endDate End date
 * @param filter Additional filters
 * @param requestId Request ID for logging
 * @returns Report file path
 */
async function generateRedemptionsReport(
  format: "csv" | "excel" | "pdf" | "json",
  startDate: Date,
  endDate: Date,
  filter?: Record<string, any>,
  requestId?: string
): Promise<string> {
  const logger = createRequestLogger(requestId);
  logger.info("Generating redemptions report");

  try {
    // Build query
    const query: Record<string, any> = {
      createdAt: { $gte: startDate, $lte: endDate },
      ...filter,
    };

    // Get redemptions
    const redemptions = await Redemption.find(query)
      .populate("user", "firstName lastName email")
      .populate("reward", "name pointsCost type")
      .sort("-createdAt")
      .lean();

    // Format data for export
    const formattedData = redemptions.map((redemption) => ({
      userId: redemption.user._id.toString(),
      userName: redemption.user
        ? `${redemption.user.firstName} ${redemption.user.lastName}`
        : "N/A",
      userEmail: redemption.user ? redemption.user.email : "N/A",
      rewardId: redemption.reward._id.toString(),
      rewardName: redemption.reward ? redemption.reward.name : "N/A",
      rewardType: redemption.reward ? redemption.reward.type : "N/A",
      pointsCost: redemption.pointsUsed,
      code: redemption.code,
      status: redemption.status,
      createdAt: new Date(redemption.createdAt).toLocaleString(),
      expiresAt: redemption.expiresAt ? new Date(redemption.expiresAt).toLocaleString() : "N/A",
      usedAt: redemption.usedAt ? new Date(redemption.usedAt).toLocaleString() : "N/A",
    }));

    // Define fields to export
    const fields = [
      "userId",
      "userName",
      "userEmail",
      "rewardId",
      "rewardName",
      "rewardType",
      "pointsCost",
      "code",
      "status",
      "createdAt",
      "expiresAt",
      "usedAt",
    ];

    // Export data
    switch (format) {
      case "csv":
        return exportService.exportToCsv(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_REDEMPTIONS,
          requestId
        );
      case "excel":
        return exportService.exportToExcel(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_REDEMPTIONS,
          requestId
        );
      case "pdf":
        return exportService.exportToPdf(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_REDEMPTIONS,
          "Loyalty Redemptions Report",
          requestId
        );
      case "json":
        return exportService.exportToJson(
          formattedData,
          exportService.ExportDataType.LOYALTY_REDEMPTIONS,
          requestId
        );
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error generating redemptions report: ${error.message}`);
    throw error;
  }
}

/**
 * Generate tiers report
 * @param format Export format
 * @param filter Additional filters
 * @param requestId Request ID for logging
 * @returns Report file path
 */
async function generateTiersReport(
  format: "csv" | "excel" | "pdf" | "json",
  filter?: Record<string, any>,
  requestId?: string
): Promise<string> {
  const logger = createRequestLogger(requestId);
  logger.info("Generating tiers report");

  try {
    // Get users by tier
    const usersByTier = await LoyaltyProgram.aggregate([
      {
        $match: filter || {},
      },
      {
        $group: {
          _id: "$tier",
          count: { $sum: 1 },
          totalPoints: { $sum: "$points" },
          avgPoints: { $avg: "$points" },
        },
      },
      {
        $lookup: {
          from: "loyaltytiers",
          localField: "_id",
          foreignField: "_id",
          as: "tierDetails",
        },
      },
      {
        $unwind: "$tierDetails",
      },
      {
        $project: {
          _id: 0,
          tierId: "$_id",
          tierName: "$tierDetails.name",
          tierLevel: "$tierDetails.level",
          pointsThreshold: "$tierDetails.pointsThreshold",
          userCount: "$count",
          totalPoints: { $round: ["$totalPoints", 0] },
          averagePoints: { $round: ["$avgPoints", 0] },
        },
      },
      {
        $sort: { tierLevel: 1 },
      },
    ]);

    // Define fields to export
    const fields = [
      "tierId",
      "tierName",
      "tierLevel",
      "pointsThreshold",
      "userCount",
      "totalPoints",
      "averagePoints",
    ];

    // Export data
    switch (format) {
      case "csv":
        return exportService.exportToCsv(
          usersByTier,
          fields,
          exportService.ExportDataType.LOYALTY_TIERS,
          requestId
        );
      case "excel":
        return exportService.exportToExcel(
          usersByTier,
          fields,
          exportService.ExportDataType.LOYALTY_TIERS,
          requestId
        );
      case "pdf":
        return exportService.exportToPdf(
          usersByTier,
          fields,
          exportService.ExportDataType.LOYALTY_TIERS,
          "Loyalty Tiers Report",
          requestId
        );
      case "json":
        return exportService.exportToJson(
          usersByTier,
          exportService.ExportDataType.LOYALTY_TIERS,
          requestId
        );
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error generating tiers report: ${error.message}`);
    throw error;
  }
}

/**
 * Generate referrals report
 * @param format Export format
 * @param startDate Start date
 * @param endDate End date
 * @param filter Additional filters
 * @param requestId Request ID for logging
 * @returns Report file path
 */
async function generateReferralsReport(
  format: "csv" | "excel" | "pdf" | "json",
  startDate: Date,
  endDate: Date,
  filter?: Record<string, any>,
  requestId?: string
): Promise<string> {
  const logger = createRequestLogger(requestId);
  logger.info("Generating referrals report");

  try {
    // Get referrals
    const referrals = await LoyaltyProgram.find({
      referredBy: { $exists: true, $ne: null },
      createdAt: { $gte: startDate, $lte: endDate },
      ...filter,
    })
      .populate("user", "firstName lastName email createdAt")
      .populate("referredBy", "firstName lastName email")
      .sort("-createdAt")
      .lean();

    // Format data for export
    const formattedData = referrals.map((referral) => ({
      userId: referral.user._id.toString(),
      userName: `${referral.user.firstName} ${referral.user.lastName}`,
      userEmail: referral.user.email,
      userCreatedAt: new Date(referral.user.createdAt).toLocaleString(),
      referrerId: referral.referredBy._id.toString(),
      referrerName: `${referral.referredBy.firstName} ${referral.referredBy.lastName}`,
      referrerEmail: referral.referredBy.email,
      referralCode: referral.referralCode,
    }));

    // Define fields to export
    const fields = [
      "userId",
      "userName",
      "userEmail",
      "userCreatedAt",
      "referrerId",
      "referrerName",
      "referrerEmail",
      "referralCode",
    ];

    // Export data
    switch (format) {
      case "csv":
        return exportService.exportToCsv(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_REFERRALS,
          requestId
        );
      case "excel":
        return exportService.exportToExcel(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_REFERRALS,
          requestId
        );
      case "pdf":
        return exportService.exportToPdf(
          formattedData,
          fields,
          exportService.ExportDataType.LOYALTY_REFERRALS,
          "Loyalty Referrals Report",
          requestId
        );
      case "json":
        return exportService.exportToJson(
          formattedData,
          exportService.ExportDataType.LOYALTY_REFERRALS,
          requestId
        );
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error generating referrals report: ${error.message}`);
    throw error;
  }
}
