import Joi from "joi"
import { NotificationType, NotificationPriority, NotificationStatus } from "../services/notification.service"

export const notificationValidation = {
  // Send notification validation
  sendNotification: Joi.object({
    body: Joi.object({
      userId: Joi.string().required().messages({
        "any.required": "User ID is required",
      }),
      type: Joi.string()
        .valid(...Object.values(NotificationType))
        .required()
        .messages({
          "any.required": "Type is required",
          "any.only": `Type must be one of: ${Object.values(NotificationType).join(", ")}`,
        }),
      title: Joi.string().required().messages({
        "any.required": "Title is required",
      }),
      message: Joi.string().required().messages({
        "any.required": "Message is required",
      }),
      priority: Joi.string()
        .valid(...Object.values(NotificationPriority))
        .default(NotificationPriority.MEDIUM),
      data: Joi.object().default({}),
      expiresAt: Joi.date().iso().optional(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Send notifications validation
  sendNotifications: Joi.object({
    body: Joi.object({
      userIds: Joi.array().items(Joi.string()).min(1).required().messages({
        "any.required": "User IDs are required",
        "array.min": "At least one user ID is required",
      }),
      type: Joi.string()
        .valid(...Object.values(NotificationType))
        .required()
        .messages({
          "any.required": "Type is required",
          "any.only": `Type must be one of: ${Object.values(NotificationType).join(", ")}`,
        }),
      title: Joi.string().required().messages({
        "any.required": "Title is required",
      }),
      message: Joi.string().required().messages({
        "any.required": "Message is required",
      }),
      priority: Joi.string()
        .valid(...Object.values(NotificationPriority))
        .default(NotificationPriority.MEDIUM),
      data: Joi.object().default({}),
      expiresAt: Joi.date().iso().optional(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Schedule notification validation
  scheduleNotification: Joi.object({
    body: Joi.object({
      userId: Joi.string().required().messages({
        "any.required": "User ID is required",
      }),
      type: Joi.string()
        .valid(...Object.values(NotificationType))
        .required()
        .messages({
          "any.required": "Type is required",
          "any.only": `Type must be one of: ${Object.values(NotificationType).join(", ")}`,
        }),
      title: Joi.string().required().messages({
        "any.required": "Title is required",
      }),
      message: Joi.string().required().messages({
        "any.required": "Message is required",
      }),
      priority: Joi.string()
        .valid(...Object.values(NotificationPriority))
        .default(NotificationPriority.MEDIUM),
      data: Joi.object().default({}),
      scheduledFor: Joi.date().iso().required().messages({
        "any.required": "Scheduled date is required",
        "date.base": "Scheduled date must be a valid date",
      }),
      expiresAt: Joi.date().iso().optional(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Clean up old notifications validation
  cleanupOldNotifications: Joi.object({
    body: Joi.object({
      olderThan: Joi.date().iso().required().messages({
        "any.required": "Older than date is required",
        "date.base": "Older than date must be a valid date",
      }),
      status: Joi.string()
        .valid(...Object.values(NotificationStatus))
        .optional(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}
