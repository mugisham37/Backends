import type { Request, Response } from "express"
import asyncHandler from "express-async-handler"
import * as notificationService from "../services/notification.service"
import { createRequestLogger } from "../config/logger"
import Joi from "joi"

// Validation schema for sending loyalty notification
const sendLoyaltyNotificationSchema = {
  body: Joi.object({
    userId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "User ID must be a valid ID",
        "any.required": "User ID is required",
      }),
    type: Joi.string()
      .valid("points_earned", "points_expired", "tier_upgrade", "reward_redeemed", "reward_approved", "reward_rejected")
      .required()
      .messages({
        "any.only":
          "Type must be one of: points_earned, points_expired, tier_upgrade, reward_redeemed, reward_approved, reward_rejected",
        "any.required": "Type is required",
      }),
    data: Joi.object().required().messages({
      "any.required": "Data is required",
    }),
  }),
}

// Validation schema for sending batch loyalty notifications
const sendBatchLoyaltyNotificationsSchema = {
  body: Joi.object({
    notifications: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .required()
            .messages({
              "string.pattern.base": "User ID must be a valid ID",
              "any.required": "User ID is required",
            }),
          type: Joi.string()
            .valid(
              "points_earned",
              "points_expired",
              "tier_upgrade",
              "reward_redeemed",
              "reward_approved",
              "reward_rejected",
            )
            .required()
            .messages({
              "any.only":
                "Type must be one of: points_earned, points_expired, tier_upgrade, reward_redeemed, reward_approved, reward_rejected",
              "any.required": "Type is required",
            }),
          data: Joi.object().required().messages({
            "any.required": "Data is required",
          }),
        }),
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one notification is required",
        "any.required": "Notifications are required",
      }),
  }),
}

/**
 * Send loyalty notification
 * @route POST /api/v1/admin/notifications/loyalty
 * @access Private (Admin)
 */
export const sendLoyaltyNotification = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Sending loyalty notification")

  const { userId, type, data } = req.body
  const result = await notificationService.sendLoyaltyNotification(userId, type, data, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      success: result,
    },
  })
})

/**
 * Send batch loyalty notifications
 * @route POST /api/v1/admin/notifications/loyalty/batch
 * @access Private (Admin)
 */
export const sendBatchLoyaltyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  requestLogger.info("Sending batch loyalty notifications")

  const { notifications } = req.body
  const result = await notificationService.sendBatchLoyaltyNotifications(notifications, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: result,
  })
})
