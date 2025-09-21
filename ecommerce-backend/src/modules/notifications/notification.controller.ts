/**
 * Notification Controller
 * Handles HTTP endpoints for notification management and preferences
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { RealtimeNotificationService } from "./realtime-notification.service.js";
import { AppError } from "../../core/errors/app-error.js";

// Validation schemas
const getNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  type: z.string().optional(),
  isRead: z.coerce.boolean().optional(),
  category: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const markAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
});

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  preferences: z
    .record(
      z.object({
        enabled: z.boolean(),
        channels: z.array(z.string()),
        frequency: z.enum(["immediate", "daily", "weekly", "never"]).optional(),
      })
    )
    .optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  quietHoursTimezone: z.string().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  digestTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
});

const sendNotificationSchema = z.object({
  userId: z.string().uuid().optional(), // Optional for admin endpoints
  type: z.enum([
    "order_created",
    "order_updated",
    "order_shipped",
    "order_delivered",
    "order_cancelled",
    "payment_received",
    "payment_failed",
    "product_approved",
    "product_rejected",
    "vendor_approved",
    "vendor_rejected",
    "payout_processed",
    "review_received",
    "system_alert",
    "security_alert",
    "welcome",
    "password_reset",
    "email_verification",
    "custom",
  ]),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  channels: z
    .array(z.enum(["in_app", "email", "sms", "push", "webhook"]))
    .optional(),
  metadata: z.record(z.any()).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  scheduledFor: z.coerce.date().optional(),
});

const sendBulkNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(1000),
  type: z.enum([
    "order_created",
    "order_updated",
    "order_shipped",
    "order_delivered",
    "order_cancelled",
    "payment_received",
    "payment_failed",
    "product_approved",
    "product_rejected",
    "vendor_approved",
    "vendor_rejected",
    "payout_processed",
    "review_received",
    "system_alert",
    "security_alert",
    "welcome",
    "password_reset",
    "email_verification",
    "custom",
  ]),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  channels: z
    .array(z.enum(["in_app", "email", "sms", "push", "webhook"]))
    .optional(),
  metadata: z.record(z.any()).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  scheduledFor: z.coerce.date().optional(),
});

export class NotificationController {
  constructor(private notificationService: RealtimeNotificationService) {}

  /**
   * Get user notifications with filtering and pagination
   */
  async getNotifications(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
      }

      const query = getNotificationsSchema.parse(req.query);

      const notifications = await this.notificationService.getUserNotifications(
        userId,
        {
          type: query.type as any,
          isRead: query.isRead,
          category: query.category,
          priority: query.priority,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        {
          limit: query.limit,
          offset: query.offset,
        }
      );

      reply.code(200).send({
        success: true,
        data: notifications,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: notifications.length,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: {
            message: "Validation failed",
            details: error.errors,
          },
        });
      } else if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Get notification statistics for the user
   */
  async getNotificationStats(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
      }

      const stats = await this.notificationService.getNotificationStats(userId);

      reply.code(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
      }

      const { notificationIds } = markAsReadSchema.parse(req.body);

      let result;
      if (notificationIds && notificationIds.length > 0) {
        // Mark specific notifications as read
        // TODO: Implement markMultipleAsRead in service
        const promises = notificationIds.map((id) =>
          this.notificationService.markAsRead(id, userId)
        );
        const results = await Promise.all(promises);
        result = { count: results.filter(Boolean).length };
      } else {
        // Mark all notifications as read
        const count = await this.notificationService.markAllAsRead(userId);
        result = { count };
      }

      reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: {
            message: "Validation failed",
            details: error.errors,
          },
        });
      } else if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
      }

      // Get preferences through the service (which will create defaults if none exist)
      const preferences = await this.notificationService.updatePreferences(
        userId,
        {}
      );

      reply.code(200).send({
        success: true,
        data: preferences,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
      }

      const preferences = updatePreferencesSchema.parse(req.body);

      const updated = await this.notificationService.updatePreferences(
        userId,
        preferences
      );

      reply.code(200).send({
        success: true,
        data: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: {
            message: "Validation failed",
            details: error.errors,
          },
        });
      } else if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Send a notification (admin only)
   */
  async sendNotification(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userRole = (req as any).user?.role;
      if (!userRole || !["admin", "moderator"].includes(userRole)) {
        throw new AppError("Insufficient permissions", 403, "FORBIDDEN");
      }

      const payload = sendNotificationSchema.parse(req.body);

      // If userId not provided, use the authenticated user's ID
      const targetUserId = payload.userId || (req as any).user?.id;
      if (!targetUserId) {
        throw new AppError(
          "Target user ID is required",
          400,
          "MISSING_USER_ID"
        );
      }

      const result = await this.notificationService.sendNotification({
        ...payload,
        userId: targetUserId,
      });

      reply.code(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: {
            message: "Validation failed",
            details: error.errors,
          },
        });
      } else if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Send bulk notifications (admin only)
   */
  async sendBulkNotification(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userRole = (req as any).user?.role;
      if (!userRole || !["admin", "moderator"].includes(userRole)) {
        throw new AppError("Insufficient permissions", 403, "FORBIDDEN");
      }

      const payload = sendBulkNotificationSchema.parse(req.body);

      const results = await this.notificationService.sendBulkNotification(
        payload
      );

      const successCount = results.filter(
        (r) => r.deliveredChannels.length > 0
      ).length;
      const failureCount = results.length - successCount;

      reply.code(201).send({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: {
            message: "Validation failed",
            details: error.errors,
          },
        });
      } else if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }

  /**
   * Test notification endpoint (development only)
   */
  async testNotification(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (process.env.NODE_ENV === "production") {
        throw new AppError(
          "Test endpoint not available in production",
          404,
          "NOT_FOUND"
        );
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
      }

      const result = await this.notificationService.sendNotification({
        userId,
        type: "custom",
        title: "Test Notification",
        message:
          "This is a test notification to verify the system is working correctly.",
        priority: "normal",
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
        category: "test",
        tags: ["test", "development"],
      });

      reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: {
            message: "Internal server error",
          },
        });
      }
    }
  }
}
