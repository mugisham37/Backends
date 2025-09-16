/**
 * Real-time Notification Service
 * Handles real-time notifications with WebSocket integration, persistence, and preferences
 */

import { EventEmitter } from "events";
import { NotificationRepository } from "../../core/repositories/notification.repository.js";
import { WebSocketService } from "./websocket.service.js";
import { EmailService } from "./email.service.js";
import { NotificationService } from "./notification.service.js";
import {
  type Notification,
  type NotificationPreferences,
  type NotificationType,
  type NotificationChannel,
  type NotificationPriority,
} from "../../core/database/schema/notifications.js";
import { AppError } from "../../core/errors/app-error.js";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  metadata?: {
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    imageUrl?: string;
    expiresAt?: string;
    [key: string]: any;
  };
  category?: string;
  tags?: string[];
  scheduledFor?: Date;
}

export interface BulkNotificationPayload {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
  category?: string;
  tags?: string[];
  scheduledFor?: Date;
}

export interface NotificationDeliveryResult {
  notificationId: string;
  userId: string;
  deliveredChannels: string[];
  failedChannels: string[];
  errors: Array<{ channel: string; error: string }>;
}

export class RealtimeNotificationService extends EventEmitter {
  private readonly defaultChannels: NotificationChannel[] = ["in_app"];
  private readonly channelHandlers: Map<
    NotificationChannel,
    (
      notification: Notification,
      preferences: NotificationPreferences
    ) => Promise<boolean>
  > = new Map();

  constructor(
    private notificationRepo: NotificationRepository,
    private websocketService: WebSocketService,
    private emailService: EmailService,
    private notificationService: NotificationService
  ) {
    super();
    this.setupChannelHandlers();
    this.setupEventListeners();
  }

  /**
   * Setup channel handlers for different notification delivery methods
   */
  private setupChannelHandlers(): void {
    // In-app notifications via WebSocket
    this.channelHandlers.set("in_app", async (notification: Notification) => {
      try {
        const sent = this.websocketService.sendToUser(notification.userId, {
          type: "notification.new",
          payload: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            metadata: notification.metadata,
            category: notification.category,
            tags: notification.tags,
            createdAt: notification.createdAt,
          },
        });
        return sent > 0;
      } catch (error) {
        console.error("Failed to send in-app notification:", error);
        return false;
      }
    });

    // Email notifications
    this.channelHandlers.set(
      "email",
      async (
        notification: Notification,
        preferences: NotificationPreferences
      ) => {
        try {
          if (!preferences.emailEnabled) {
            return false;
          }

          // Check quiet hours
          if (this.isInQuietHours(preferences)) {
            // Schedule for later delivery
            await this.scheduleNotification(
              notification,
              new Date(Date.now() + 60 * 60 * 1000)
            ); // 1 hour later
            return false;
          }

          // Get email template for notification type
          const template = await this.notificationRepo.findTemplate(
            notification.type,
            "email",
            "en" // TODO: Get user's preferred language
          );

          if (template) {
            await this.emailService.sendEmail(
              `notification-${notification.type}`,
              {
                title: notification.title,
                message: notification.message,
                metadata: notification.metadata,
                actionUrl: notification.metadata?.actionUrl,
              },
              {
                to: notification.userId, // TODO: Get user's email from user service
                subject: template.subject || notification.title,
              }
            );
            return true;
          } else {
            // Fallback to generic notification email
            await this.notificationService.queueEmail(
              "generic-notification",
              {
                title: notification.title,
                message: notification.message,
                actionUrl: notification.metadata?.actionUrl,
              },
              {
                to: notification.userId, // TODO: Get user's email
                subject: notification.title,
              }
            );
            return true;
          }
        } catch (error) {
          console.error("Failed to send email notification:", error);
          return false;
        }
      }
    );

    // SMS notifications (placeholder)
    this.channelHandlers.set(
      "sms",
      async (
        notification: Notification,
        preferences: NotificationPreferences
      ) => {
        try {
          if (!preferences.smsEnabled) {
            return false;
          }

          // TODO: Implement SMS sending logic
          console.log(`SMS notification would be sent: ${notification.title}`);
          return true;
        } catch (error) {
          console.error("Failed to send SMS notification:", error);
          return false;
        }
      }
    );

    // Push notifications (placeholder)
    this.channelHandlers.set(
      "push",
      async (
        notification: Notification,
        preferences: NotificationPreferences
      ) => {
        try {
          if (!preferences.pushEnabled) {
            return false;
          }

          // TODO: Implement push notification logic
          console.log(`Push notification would be sent: ${notification.title}`);
          return true;
        } catch (error) {
          console.error("Failed to send push notification:", error);
          return false;
        }
      }
    );

    // Webhook notifications (placeholder)
    this.channelHandlers.set("webhook", async (notification: Notification) => {
      try {
        // TODO: Implement webhook logic
        console.log(
          `Webhook notification would be sent: ${notification.title}`
        );
        return true;
      } catch (error) {
        console.error("Failed to send webhook notification:", error);
        return false;
      }
    });
  }

  /**
   * Setup event listeners for WebSocket and other services
   */
  private setupEventListeners(): void {
    // Listen for WebSocket events
    this.websocketService.on(
      "notification.mark_read",
      async (data: { userId: string; notificationId: string }) => {
        await this.markAsRead(data.notificationId, data.userId);
      }
    );

    // Listen for connection events to send pending notifications
    this.websocketService.on(
      "connection",
      async (data: { user: any; connectionId: string }) => {
        await this.sendPendingNotifications(data.user.id);
      }
    );
  }

  /**
   * Send a single notification
   */
  async sendNotification(
    payload: NotificationPayload
  ): Promise<NotificationDeliveryResult> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(payload.userId);

      // Determine channels to use
      const channels = this.determineChannels(payload, preferences);

      // Create notification in database
      const notification = await this.notificationRepo.create({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        priority: payload.priority || "normal",
        channels,
        metadata: payload.metadata,
        category: payload.category,
        tags: payload.tags,
        scheduledFor: payload.scheduledFor,
      });

      // Deliver notification if not scheduled
      if (!payload.scheduledFor || payload.scheduledFor <= new Date()) {
        return await this.deliverNotification(notification, preferences);
      }

      return {
        notificationId: notification.id,
        userId: payload.userId,
        deliveredChannels: [],
        failedChannels: [],
        errors: [],
      };
    } catch (error) {
      throw new AppError(
        `Failed to send notification: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "NOTIFICATION_SEND_FAILED"
      );
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  async sendBulkNotification(
    payload: BulkNotificationPayload
  ): Promise<NotificationDeliveryResult[]> {
    try {
      const results: NotificationDeliveryResult[] = [];

      // Process in batches to avoid overwhelming the system
      const batchSize = 100;
      for (let i = 0; i < payload.userIds.length; i += batchSize) {
        const batch = payload.userIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (userId) => {
          return this.sendNotification({
            ...payload,
            userId,
          });
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            results.push({
              notificationId: "",
              userId: batch[index],
              deliveredChannels: [],
              failedChannels: payload.channels || this.defaultChannels,
              errors: [
                {
                  channel: "all",
                  error: result.reason?.message || "Unknown error",
                },
              ],
            });
          }
        });
      }

      return results;
    } catch (error) {
      throw new AppError(
        `Failed to send bulk notifications: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "BULK_NOTIFICATION_SEND_FAILED"
      );
    }
  }

  /**
   * Deliver a notification through all specified channels
   */
  private async deliverNotification(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    const deliveredChannels: string[] = [];
    const failedChannels: string[] = [];
    const errors: Array<{ channel: string; error: string }> = [];

    for (const channel of notification.channels as NotificationChannel[]) {
      try {
        const handler = this.channelHandlers.get(channel);
        if (handler) {
          const success = await handler(notification, preferences);
          if (success) {
            deliveredChannels.push(channel);
          } else {
            failedChannels.push(channel);
          }
        } else {
          failedChannels.push(channel);
          errors.push({ channel, error: "No handler available" });
        }
      } catch (error) {
        failedChannels.push(channel);
        errors.push({
          channel,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update notification with delivery status
    await this.notificationRepo.markAsDelivered(
      notification.id,
      deliveredChannels
    );

    // Emit delivery event
    this.emit("notification.delivered", {
      notification,
      deliveredChannels,
      failedChannels,
      errors,
    });

    return {
      notificationId: notification.id,
      userId: notification.userId,
      deliveredChannels,
      failedChannels,
      errors,
    };
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(
    userId: string
  ): Promise<NotificationPreferences> {
    let preferences = await this.notificationRepo.findPreferencesByUserId(
      userId
    );

    if (!preferences) {
      // Create default preferences
      preferences = await this.notificationRepo.createPreferences({
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        preferences: {},
      });
    }

    return preferences;
  }

  /**
   * Determine which channels to use for a notification
   */
  private determineChannels(
    payload: NotificationPayload,
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    if (payload.channels) {
      return payload.channels;
    }

    const channels: NotificationChannel[] = [];

    // Check type-specific preferences
    const typePrefs = preferences.preferences?.[payload.type];
    if (typePrefs) {
      if (typePrefs.enabled) {
        return typePrefs.channels as NotificationChannel[];
      } else {
        return []; // Type is disabled
      }
    }

    // Use global preferences
    if (preferences.inAppEnabled) channels.push("in_app");
    if (preferences.emailEnabled) channels.push("email");
    if (preferences.smsEnabled) channels.push("sms");
    if (preferences.pushEnabled) channels.push("push");

    return channels.length > 0 ? channels : this.defaultChannels;
  }

  /**
   * Check if current time is within user's quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (
      !preferences.quietHoursEnabled ||
      !preferences.quietHoursStart ||
      !preferences.quietHoursEnd
    ) {
      return false;
    }

    const now = new Date();
    const timezone = preferences.quietHoursTimezone || "UTC";

    // TODO: Implement proper timezone handling
    const currentTime = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });

    const startTime = preferences.quietHoursStart;
    const endTime = preferences.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  /**
   * Schedule a notification for later delivery
   */
  private async scheduleNotification(
    notification: Notification,
    scheduledFor: Date
  ): Promise<void> {
    await this.notificationRepo.create({
      ...notification,
      id: undefined, // Let database generate new ID
      scheduledFor,
      deliveredAt: null,
    });
  }

  /**
   * Send pending notifications when user connects
   */
  private async sendPendingNotifications(userId: string): Promise<void> {
    try {
      const unreadNotifications = await this.notificationRepo.findByUserId(
        userId,
        { isRead: false },
        { limit: 50 }
      );

      for (const notification of unreadNotifications) {
        if (notification.channels.includes("in_app")) {
          this.websocketService.sendToUser(userId, {
            type: "notification.new",
            payload: {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              priority: notification.priority,
              metadata: notification.metadata,
              category: notification.category,
              tags: notification.tags,
              createdAt: notification.createdAt,
            },
          });
        }
      }
    } catch (error) {
      console.error("Failed to send pending notifications:", error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const success = await this.notificationRepo.markAsRead(
      notificationId,
      userId
    );

    if (success) {
      // Notify other user connections
      this.websocketService.sendToUser(userId, {
        type: "notification.read",
        payload: { notificationId },
      });

      this.emit("notification.read", { notificationId, userId });
    }

    return success;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.notificationRepo.markAllAsRead(userId);

    if (count > 0) {
      // Notify user connections
      this.websocketService.sendToUser(userId, {
        type: "notification.all_read",
        payload: { count },
      });

      this.emit("notification.all_read", { userId, count });
    }

    return count;
  }

  /**
   * Get user notifications with filtering and pagination
   */
  async getUserNotifications(
    userId: string,
    filters: any = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<Notification[]> {
    return this.notificationRepo.findByUserId(userId, filters, pagination);
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<any> {
    return this.notificationRepo.getStats(userId);
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const updated = await this.notificationRepo.upsertPreferences(
      userId,
      preferences
    );

    this.emit("preferences.updated", { userId, preferences: updated });

    return updated;
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications =
        await this.notificationRepo.getScheduledNotifications(new Date());

      for (const notification of scheduledNotifications) {
        const preferences = await this.getUserPreferences(notification.userId);
        await this.deliverNotification(notification, preferences);
      }
    } catch (error) {
      console.error("Failed to process scheduled notifications:", error);
    }
  }

  /**
   * Convenience methods for common notification types
   */
  async sendOrderNotification(
    userId: string,
    orderId: string,
    type:
      | "order_created"
      | "order_updated"
      | "order_shipped"
      | "order_delivered"
      | "order_cancelled",
    orderData: any
  ): Promise<NotificationDeliveryResult> {
    const titles = {
      order_created: "Order Confirmed",
      order_updated: "Order Updated",
      order_shipped: "Order Shipped",
      order_delivered: "Order Delivered",
      order_cancelled: "Order Cancelled",
    };

    const messages = {
      order_created: `Your order #${orderId} has been confirmed and is being processed.`,
      order_updated: `Your order #${orderId} has been updated.`,
      order_shipped: `Your order #${orderId} has been shipped and is on its way.`,
      order_delivered: `Your order #${orderId} has been delivered.`,
      order_cancelled: `Your order #${orderId} has been cancelled.`,
    };

    return this.sendNotification({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      priority: type === "order_cancelled" ? "high" : "normal",
      metadata: {
        entityType: "order",
        entityId: orderId,
        actionUrl: `/orders/${orderId}`,
        ...orderData,
      },
      category: "orders",
      tags: ["order", type],
    });
  }

  async sendPaymentNotification(
    userId: string,
    paymentId: string,
    type: "payment_received" | "payment_failed",
    paymentData: any
  ): Promise<NotificationDeliveryResult> {
    const titles = {
      payment_received: "Payment Received",
      payment_failed: "Payment Failed",
    };

    const messages = {
      payment_received: `Your payment of ${paymentData.amount} ${paymentData.currency} has been received.`,
      payment_failed: `Your payment of ${paymentData.amount} ${paymentData.currency} has failed.`,
    };

    return this.sendNotification({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      priority: type === "payment_failed" ? "high" : "normal",
      metadata: {
        entityType: "payment",
        entityId: paymentId,
        ...paymentData,
      },
      category: "payments",
      tags: ["payment", type],
    });
  }

  async sendSystemAlert(
    userIds: string[],
    title: string,
    message: string,
    priority: NotificationPriority = "normal"
  ): Promise<NotificationDeliveryResult[]> {
    return this.sendBulkNotification({
      userIds,
      type: "system_alert",
      title,
      message,
      priority,
      category: "system",
      tags: ["system", "alert"],
    });
  }

  /**
   * Cleanup old notifications
   */
  async cleanupOldNotifications(olderThanDays = 90): Promise<number> {
    return this.notificationRepo.deleteOldNotifications(olderThanDays);
  }
}
