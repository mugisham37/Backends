import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import * as batchService from "../services/batch.service";
import * as settingsService from "../services/settings.service";
import { createRequestLogger } from "../config/logger";
import Joi from "joi";

// Validation schema for batch loyalty points
const batchLoyaltyPointsSchema = {
  body: Joi.object({
    operations: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .required()
            .messages({
              "string.pattern.base": "User ID must be a valid ID",
              "any.required": "User ID is required",
            }),
          points: Joi.number().required().messages({
            "number.base": "Points must be a number",
            "any.required": "Points are required",
          }),
          description: Joi.string().required().messages({
            "string.empty": "Description is required",
            "any.required": "Description is required",
          }),
          referenceId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
          type: Joi.string().valid("order", "referral", "manual", "other"),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one operation is required",
        "any.required": "Operations are required",
      }),
  }),
};

/**
 * Process batch loyalty points
 * @route POST /api/v1/admin/batch/loyalty-points
 * @access Private (Admin)
 */
export const processBatchLoyaltyPoints = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Processing batch loyalty points");

  const { operations } = req.body;
  const result = await batchService.processBatchLoyaltyPoints(operations, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: result,
  });
});

/**
 * Process batch expired points
 * @route POST /api/v1/admin/batch/expired-points
 * @access Private (Admin)
 */
export const processBatchExpiredPoints = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Processing batch expired points");

  // Get expiry days from settings
  const expiryDays = await settingsService.getSetting("loyalty.pointsExpiryDays", 365, req.id);
  const batchSize = req.body.batchSize || 100;

  const result = await batchService.processBatchExpiredPoints(expiryDays, batchSize, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: result,
  });
});
