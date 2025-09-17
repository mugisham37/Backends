/**
 * GraphQL Resolvers for Notifications
 * Handles GraphQL queries, mutations, and subscriptions for notifications
 */

import { GraphQLError } from "graphql";
import { withFilter, PubSub } from "graphql-subscriptions";
import { RealtimeNotificationService } from "../../../modules/notifications/realtime-notification.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import { GraphQLContext } from "../context.js";

const pubsub = new PubSub() as any; // Temporary fix for TypeScript issues

export function createNotificationResolvers(
  notificationService: RealtimeNotificationService
) {
  return {
    Query: {
      notifications: async (
        _: any,
        args: {
          filter?: {
            type?: string;
            isRead?: boolean;
            category?: string;
            priority?: string;
            dateFrom?: Date;
            dateTo?: Date;
          };
          pagination?: {
            limit?: number;
            offset?: number;
          };
        },
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          const { filter = {}, pagination = {} } = args;

          const notifications = await notificationService.getUserNotifications(
            context.user.id,
            {
              type: filter.type as any,
              isRead: filter.isRead,
              category: filter.category,
              priority: filter.priority,
              dateFrom: filter.dateFrom,
              dateTo: filter.dateTo,
            },
            {
              limit: pagination.limit || 20,
              offset: pagination.offset || 0,
            }
          );

          // Get total count for pagination
          const stats = await notificationService.getNotificationStats(
            context.user.id
          );

          return {
            nodes: notifications,
            totalCount: stats.total,
            hasNextPage: notifications.length === (pagination.limit || 20),
            hasPreviousPage: (pagination.offset || 0) > 0,
          };
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to fetch notifications",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      notification: async (
        _: any,
        args: { id: string },
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          const notifications = await notificationService.getUserNotifications(
            context.user.id,
            {},
            { limit: 1000 } // Get all to find the specific one
          );

          const notification = notifications.find((n) => n.id === args.id);

          if (!notification) {
            throw new GraphQLError("Notification not found", {
              extensions: { code: "NOT_FOUND" },
            });
          }

          return notification;
        } catch (error) {
          if (error instanceof GraphQLError) {
            throw error;
          }
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to fetch notification",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      notificationStats: async (_: any, __: any, context: GraphQLContext) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          return await notificationService.getNotificationStats(
            context.user.id
          );
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to fetch notification stats",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      notificationPreferences: async (
        _: any,
        __: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          // This will create default preferences if none exist
          return await notificationService.updatePreferences(
            context.user.id,
            {}
          );
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to fetch notification preferences",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },
    },

    Mutation: {
      markNotificationsAsRead: async (
        _: any,
        args: { input: { notificationIds?: string[] } },
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          const { notificationIds } = args.input;

          if (notificationIds && notificationIds.length > 0) {
            // Mark specific notifications as read
            const promises = notificationIds.map((id) =>
              notificationService.markAsRead(id, context.user!.id)
            );
            const results = await Promise.all(promises);
            return results.filter(Boolean).length;
          } else {
            // Mark all notifications as read
            return await notificationService.markAllAsRead(context.user.id);
          }
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to mark notifications as read",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      markAllNotificationsAsRead: async (
        _: any,
        __: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          return await notificationService.markAllAsRead(context.user.id);
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to mark all notifications as read",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      updateNotificationPreferences: async (
        _: any,
        args: { input: any },
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        try {
          return await notificationService.updatePreferences(
            context.user.id,
            args.input
          );
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to update notification preferences",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      sendNotification: async (
        _: any,
        args: { input: any },
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (!["admin", "moderator"].includes(context.user.role)) {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        try {
          const { input } = args;
          const targetUserId = input.userId || context.user.id;

          return await notificationService.sendNotification({
            ...input,
            userId: targetUserId,
          });
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to send notification",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      sendBulkNotifications: async (
        _: any,
        args: { input: any },
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (!["admin", "moderator"].includes(context.user.role)) {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        try {
          return await notificationService.sendBulkNotification(args.input);
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to send bulk notifications",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },

      sendTestNotification: async (
        _: any,
        __: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (process.env.NODE_ENV === "production") {
          throw new GraphQLError(
            "Test notifications not available in production",
            {
              extensions: { code: "NOT_AVAILABLE" },
            }
          );
        }

        try {
          return await notificationService.sendNotification({
            userId: context.user.id,
            type: "custom",
            title: "Test Notification",
            message: "This is a test notification sent via GraphQL.",
            priority: "normal",
            metadata: {
              test: true,
              timestamp: new Date().toISOString(),
              source: "graphql",
            },
            category: "test",
            tags: ["test", "graphql"],
          });
        } catch (error) {
          throw new GraphQLError(
            error instanceof Error
              ? error.message
              : "Failed to send test notification",
            {
              extensions: { code: "INTERNAL_ERROR" },
            }
          );
        }
      },
    },

    Subscription: {
      notificationReceived: {
        subscribe: withFilter(
          (_, __, context: GraphQLContext | undefined) => {
            if (!context || !context.user) {
              throw new GraphQLError("Authentication required", {
                extensions: { code: "UNAUTHENTICATED" },
              });
            }
            return pubsub.asyncIterator([
              `NOTIFICATION_RECEIVED_${context.user.id}`,
            ]);
          },
          (payload, _, context: GraphQLContext | undefined) => {
            if (!context?.user) return false;
            return payload.userId === context.user.id;
          }
        ),
      },

      notificationRead: {
        subscribe: withFilter(
          (_, __, context: GraphQLContext | undefined) => {
            if (!context || !context.user) {
              throw new GraphQLError("Authentication required", {
                extensions: { code: "UNAUTHENTICATED" },
              });
            }
            return pubsub.asyncIterator([
              `NOTIFICATION_READ_${context.user.id}`,
            ]);
          },
          (payload, _, context: GraphQLContext | undefined) => {
            if (!context?.user) return false;
            return payload.userId === context.user.id;
          }
        ),
      },

      notificationStatsUpdated: {
        subscribe: withFilter(
          (_, __, context: GraphQLContext | undefined) => {
            if (!context || !context.user) {
              throw new GraphQLError("Authentication required", {
                extensions: { code: "UNAUTHENTICATED" },
              });
            }
            return pubsub.asyncIterator([
              `NOTIFICATION_STATS_${context.user.id}`,
            ]);
          },
          (payload, _, context: GraphQLContext | undefined) => {
            if (!context?.user) return false;
            return payload.userId === context.user.id;
          }
        ),
      },
    },

    // Field resolvers
    Notification: {
      // Convert database enum values to GraphQL enum values
      type: (notification: any) => notification.type.toUpperCase(),
      priority: (notification: any) => notification.priority.toUpperCase(),
      channels: (notification: any) =>
        notification.channels.map((channel: string) => channel.toUpperCase()),
      deliveredChannels: (notification: any) =>
        notification.deliveredChannels.map((channel: string) =>
          channel.toUpperCase()
        ),
    },

    NotificationPreferences: {
      // Convert database values to GraphQL format if needed
      quietHoursTimezone: (preferences: any) =>
        preferences.quietHoursTimezone || "UTC",
      digestTime: (preferences: any) => preferences.digestTime || "09:00",
    },
  };
}

export default createNotificationResolvers;
