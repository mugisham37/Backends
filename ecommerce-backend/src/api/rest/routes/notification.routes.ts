/**
 * Notification REST API routes
 * Fastify-based routes with proper validation and security
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { eq, and } from "drizzle-orm";
import { notifications } from "../../../core/database/schema/notifications.js";
import { NotificationService } from "../../../modules/notifications/notification.service.js";
import { RealtimeNotificationService } from "../../../modules/notifications/realtime-notification.service.js";
import { EmailService } from "../../../modules/notifications/email.service.js";
import { WebSocketService } from "../../../modules/notifications/websocket.service.js";
import { NotificationRepository } from "../../../core/repositories/notification.repository.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { db } from "../../../core/database/connection.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils.js";

// Interfaces for request/response types
interface NotificationParams {
  id: string;
}

interface NotificationQuery {
  limit?: string;
  offset?: string;
  type?: string;
  isRead?: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  dateFrom?: string;
  dateTo?: string;
}

interface NotificationMarkBody {
  isRead: boolean;
}

interface BulkMarkBody {
  notificationIds: string[];
  isRead: boolean;
}

export async function notificationRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const notificationRepo = new NotificationRepository(db);
  const websocketService = new WebSocketService();

  // Create email config
  const emailConfig = {
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || "E-commerce Platform",
      email: process.env.EMAIL_FROM_ADDRESS || "noreply@example.com",
    },
    templatesPath: process.env.EMAIL_TEMPLATES_PATH || "./src/templates",
  };

  const emailService = new EmailService(emailConfig);

  // Create notification config for the queue service
  const notificationConfig = {
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || "0"),
    },
    queue: {
      name: "notifications",
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    },
  };

  const notificationService = new NotificationService(
    emailService,
    notificationConfig
  );
  const realtimeNotificationService = new RealtimeNotificationService(
    notificationRepo,
    websocketService,
    emailService,
    notificationService
  );

  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all notification routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to notification endpoints
  const notificationRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Get user notifications with filtering and pagination
  fastify.get<{
    Querystring: NotificationQuery;
  }>("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          limit: { type: "string", default: "20" },
          offset: { type: "string", default: "0" },
          type: { type: "string" },
          isRead: { type: "string" },
          category: { type: "string" },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
          },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (
      request: FastifyRequest<{ Querystring: NotificationQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request.user as any)?.id;
        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        const {
          limit = "20",
          offset = "0",
          type,
          isRead,
          category,
          priority,
          dateFrom,
          dateTo,
        } = request.query;

        const filters = {
          userId,
          ...(type && { type }),
          ...(isRead !== undefined && { isRead: isRead === "true" }),
          ...(category && { category }),
          ...(priority && { priority }),
          ...(dateFrom && { dateFrom: new Date(dateFrom) }),
          ...(dateTo && { dateTo: new Date(dateTo) }),
          limit: Math.min(parseInt(limit), 100), // Max 100 per request
          offset: parseInt(offset),
        };

        const notifications =
          await realtimeNotificationService.getUserNotifications(
            userId,
            filters
          );

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(notifications, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(
            message,
            "FETCH_NOTIFICATIONS_FAILED",
            undefined,
            {
              requestId: (request as any).id,
            }
          )
        );
      }
    },
  });

  // Get notification statistics
  fastify.get("/stats", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.id;
        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        const stats = await realtimeNotificationService.getNotificationStats(
          userId
        );

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(stats, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch notification stats";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_STATS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get single notification
  fastify.get<{
    Params: NotificationParams;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: NotificationParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // Get single notification using repository
        const allNotifications = await notificationRepo.findByUserId(userId);
        const notification = allNotifications.find((n) => n.id === id);

        if (!notification) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send(
              ResponseBuilder.error(
                "Notification not found",
                "NOTIFICATION_NOT_FOUND",
                undefined,
                { requestId: (request as any).id }
              )
            );
        }

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(notification, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch notification";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(
            message,
            "FETCH_NOTIFICATION_FAILED",
            undefined,
            {
              requestId: (request as any).id,
            }
          )
        );
      }
    },
  });

  // Mark notification as read/unread
  fastify.patch<{
    Params: NotificationParams;
    Body: NotificationMarkBody;
  }>("/:id/mark", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          isRead: { type: "boolean" },
        },
        required: ["isRead"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (
      request: FastifyRequest<{
        Params: NotificationParams;
        Body: NotificationMarkBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { isRead } = request.body;
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        const success = await realtimeNotificationService.markAsRead(
          id,
          userId
        );

        if (!success) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send(
              ResponseBuilder.error(
                "Notification not found or already marked",
                "NOTIFICATION_NOT_FOUND"
              )
            );
        }

        // Get updated notification
        const allNotifications = await notificationRepo.findByUserId(userId);
        const notification = allNotifications.find((n) => n.id === id);

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(notification, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to mark notification";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(
            message,
            "MARK_NOTIFICATION_FAILED",
            undefined,
            {
              requestId: (request as any).id,
            }
          )
        );
      }
    },
  });

  // Mark all notifications as read
  fastify.patch("/mark-all-read", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.id;
        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        const count = await realtimeNotificationService.markAllAsRead(userId);

        const result = {
          markedCount: count,
          message: `${count} notifications marked as read`,
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(result, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to mark all notifications as read";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "MARK_ALL_READ_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Bulk mark notifications
  fastify.patch<{
    Body: BulkMarkBody;
  }>("/bulk-mark", {
    schema: {
      body: {
        type: "object",
        properties: {
          notificationIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 100,
          },
          isRead: { type: "boolean" },
        },
        required: ["notificationIds", "isRead"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: BulkMarkBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { notificationIds, isRead } = request.body;
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // Bulk mark notifications - we'll do it sequentially for now
        let successCount = 0;
        for (const notificationId of notificationIds) {
          const success = await notificationRepo.markAsRead(
            notificationId,
            userId
          );
          if (success) successCount++;
        }

        const result = {
          processedCount: notificationIds.length,
          successCount,
          message: `${successCount}/${notificationIds.length} notifications marked successfully`,
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(result, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to bulk mark notifications";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "BULK_MARK_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Delete notification
  fastify.delete<{
    Params: NotificationParams;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      response: {
        204: {
          type: "null",
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: NotificationParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // Delete notification using direct database operation
        const deleteResult = await db
          .delete(notifications)
          .where(
            and(eq(notifications.id, id), eq(notifications.userId, userId))
          )
          .returning();

        if (deleteResult.length === 0) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send(
              ResponseBuilder.error(
                "Notification not found",
                "NOTIFICATION_NOT_FOUND",
                undefined,
                { requestId: (request as any).id }
              )
            );
        }

        return reply.status(HTTP_STATUS.NO_CONTENT).send();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to delete notification";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(
            message,
            "DELETE_NOTIFICATION_FAILED",
            undefined,
            {
              requestId: (request as any).id,
            }
          )
        );
      }
    },
  });

  // Clear all notifications
  fastify.delete("/clear-all", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, notificationRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.id;
        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // Clear all notifications for user
        const deleteResult = await db
          .delete(notifications)
          .where(eq(notifications.userId, userId))
          .returning();

        const result = {
          deletedCount: deleteResult.length,
          message: `${deleteResult.length} notifications cleared successfully`,
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(result, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to clear all notifications";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "CLEAR_ALL_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });
}
