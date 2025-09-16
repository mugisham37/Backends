/**
 * Real-time Notification Service Tests
 * Tests for the real-time notification system functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RealtimeNotificationService } from "../realtime-notification.service.js";
import { NotificationRepository } from "../../../core/repositories/notification.repository.js";
import { WebSocketService } from "../websocket.service.js";
import { EmailService } from "../email.service.js";
import { NotificationService } from "../notification.service.js";

// Mock dependencies
const mockNotificationRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  getStats: vi.fn(),
  findPreferencesByUserId: vi.fn(),
  createPreferences: vi.fn(),
  upsertPreferences: vi.fn(),
  markAsDelivered: vi.fn(),
  getScheduledNotifications: vi.fn(),
  findTemplate: vi.fn(),
} as unknown as NotificationRepository;

const mockWebSocketService = {
  sendToUser: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
} as unknown as WebSocketService;

const mockEmailService = {
  sendEmail: vi.fn(),
} as unknown as EmailService;

const mockNotificationService = {
  queueEmail: vi.fn(),
} as unknown as NotificationService;

describe("RealtimeNotificationService", () => {
  let service: RealtimeNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RealtimeNotificationService(
      mockNotificationRepo,
      mockWebSocketService,
      mockEmailService,
      mockNotificationService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendNotification", () => {
    it("should send a notification successfully", async () => {
      const userId = "user-123";
      const notificationPayload = {
        userId,
        type: "order_created" as const,
        title: "Order Confirmed",
        message: "Your order has been confirmed",
        priority: "normal" as const,
      };

      const mockPreferences = {
        id: "pref-123",
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        preferences: {},
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTimezone: "UTC",
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
        digestTime: "09:00",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotification = {
        id: "notif-123",
        userId,
        type: "order_created",
        title: "Order Confirmed",
        message: "Your order has been confirmed",
        priority: "normal",
        channels: ["in_app"],
        deliveredChannels: [],
        isRead: false,
        readAt: null,
        metadata: null,
        category: null,
        tags: [],
        scheduledFor: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepo.findPreferencesByUserId = vi
        .fn()
        .mockResolvedValue(mockPreferences);
      mockNotificationRepo.create = vi.fn().mockResolvedValue(mockNotification);
      mockNotificationRepo.markAsDelivered = vi.fn().mockResolvedValue(true);
      mockWebSocketService.sendToUser = vi.fn().mockReturnValue(1);

      const result = await service.sendNotification(notificationPayload);

      expect(result).toEqual({
        notificationId: "notif-123",
        userId,
        deliveredChannels: ["in_app"],
        failedChannels: [],
        errors: [],
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith({
        userId,
        type: "order_created",
        title: "Order Confirmed",
        message: "Your order has been confirmed",
        priority: "normal",
        channels: ["in_app"],
        metadata: undefined,
        category: undefined,
        tags: undefined,
        scheduledFor: undefined,
      });

      expect(mockWebSocketService.sendToUser).toHaveBeenCalledWith(userId, {
        type: "notification.new",
        payload: expect.objectContaining({
          id: "notif-123",
          type: "order_created",
          title: "Order Confirmed",
          message: "Your order has been confirmed",
        }),
      });
    });

    it("should create default preferences if none exist", async () => {
      const userId = "user-456";
      const notificationPayload = {
        userId,
        type: "welcome" as const,
        title: "Welcome!",
        message: "Welcome to our platform",
      };

      const mockDefaultPreferences = {
        id: "pref-456",
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        preferences: {},
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTimezone: "UTC",
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
        digestTime: "09:00",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotification = {
        id: "notif-456",
        userId,
        type: "welcome",
        title: "Welcome!",
        message: "Welcome to our platform",
        priority: "normal",
        channels: ["in_app"],
        deliveredChannels: [],
        isRead: false,
        readAt: null,
        metadata: null,
        category: null,
        tags: [],
        scheduledFor: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepo.findPreferencesByUserId = vi
        .fn()
        .mockResolvedValue(null);
      mockNotificationRepo.createPreferences = vi
        .fn()
        .mockResolvedValue(mockDefaultPreferences);
      mockNotificationRepo.create = vi.fn().mockResolvedValue(mockNotification);
      mockNotificationRepo.markAsDelivered = vi.fn().mockResolvedValue(true);
      mockWebSocketService.sendToUser = vi.fn().mockReturnValue(1);

      await service.sendNotification(notificationPayload);

      expect(mockNotificationRepo.createPreferences).toHaveBeenCalledWith({
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        preferences: {},
      });
    });

    it("should handle scheduled notifications", async () => {
      const userId = "user-789";
      const scheduledFor = new Date(Date.now() + 60000); // 1 minute from now
      const notificationPayload = {
        userId,
        type: "system_alert" as const,
        title: "Scheduled Alert",
        message: "This is a scheduled notification",
        scheduledFor,
      };

      const mockPreferences = {
        id: "pref-789",
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        preferences: {},
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTimezone: "UTC",
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
        digestTime: "09:00",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotification = {
        id: "notif-789",
        userId,
        type: "system_alert",
        title: "Scheduled Alert",
        message: "This is a scheduled notification",
        priority: "normal",
        channels: ["in_app"],
        deliveredChannels: [],
        isRead: false,
        readAt: null,
        metadata: null,
        category: null,
        tags: [],
        scheduledFor,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepo.findPreferencesByUserId = vi
        .fn()
        .mockResolvedValue(mockPreferences);
      mockNotificationRepo.create = vi.fn().mockResolvedValue(mockNotification);

      const result = await service.sendNotification(notificationPayload);

      expect(result).toEqual({
        notificationId: "notif-789",
        userId,
        deliveredChannels: [],
        failedChannels: [],
        errors: [],
      });

      // Should not deliver immediately for scheduled notifications
      expect(mockWebSocketService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe("sendBulkNotification", () => {
    it("should send notifications to multiple users", async () => {
      const userIds = ["user-1", "user-2", "user-3"];
      const bulkPayload = {
        userIds,
        type: "system_alert" as const,
        title: "System Maintenance",
        message: "System will be down for maintenance",
        priority: "high" as const,
      };

      // Mock individual notification sending
      const mockResults = userIds.map((userId, index) => ({
        notificationId: `notif-${index + 1}`,
        userId,
        deliveredChannels: ["in_app"],
        failedChannels: [],
        errors: [],
      }));

      // Mock the sendNotification method
      const sendNotificationSpy = vi.spyOn(service, "sendNotification");
      sendNotificationSpy.mockImplementation(async (payload) => {
        const index = userIds.indexOf(payload.userId);
        return mockResults[index];
      });

      const results = await service.sendBulkNotification(bulkPayload);

      expect(results).toHaveLength(3);
      expect(sendNotificationSpy).toHaveBeenCalledTimes(3);

      userIds.forEach((userId, index) => {
        expect(sendNotificationSpy).toHaveBeenNthCalledWith(index + 1, {
          ...bulkPayload,
          userId,
        });
      });

      sendNotificationSpy.mockRestore();
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read and notify WebSocket clients", async () => {
      const notificationId = "notif-123";
      const userId = "user-123";

      mockNotificationRepo.markAsRead = vi.fn().mockResolvedValue(true);
      mockWebSocketService.sendToUser = vi.fn().mockReturnValue(1);

      const result = await service.markAsRead(notificationId, userId);

      expect(result).toBe(true);
      expect(mockNotificationRepo.markAsRead).toHaveBeenCalledWith(
        notificationId,
        userId
      );
      expect(mockWebSocketService.sendToUser).toHaveBeenCalledWith(userId, {
        type: "notification.read",
        payload: { notificationId },
      });
    });

    it("should not send WebSocket message if marking as read fails", async () => {
      const notificationId = "notif-456";
      const userId = "user-456";

      mockNotificationRepo.markAsRead = vi.fn().mockResolvedValue(false);

      const result = await service.markAsRead(notificationId, userId);

      expect(result).toBe(false);
      expect(mockWebSocketService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe("convenience methods", () => {
    it("should send order notification with correct metadata", async () => {
      const userId = "user-123";
      const orderId = "order-456";
      const orderData = { total: 99.99, currency: "USD" };

      const sendNotificationSpy = vi.spyOn(service, "sendNotification");
      sendNotificationSpy.mockResolvedValue({
        notificationId: "notif-123",
        userId,
        deliveredChannels: ["in_app"],
        failedChannels: [],
        errors: [],
      });

      await service.sendOrderNotification(
        userId,
        orderId,
        "order_created",
        orderData
      );

      expect(sendNotificationSpy).toHaveBeenCalledWith({
        userId,
        type: "order_created",
        title: "Order Confirmed",
        message: `Your order #${orderId} has been confirmed and is being processed.`,
        priority: "normal",
        metadata: {
          entityType: "order",
          entityId: orderId,
          actionUrl: `/orders/${orderId}`,
          ...orderData,
        },
        category: "orders",
        tags: ["order", "order_created"],
      });

      sendNotificationSpy.mockRestore();
    });

    it("should send payment notification with high priority for failures", async () => {
      const userId = "user-123";
      const paymentId = "payment-456";
      const paymentData = { amount: 50.0, currency: "USD" };

      const sendNotificationSpy = vi.spyOn(service, "sendNotification");
      sendNotificationSpy.mockResolvedValue({
        notificationId: "notif-123",
        userId,
        deliveredChannels: ["in_app"],
        failedChannels: [],
        errors: [],
      });

      await service.sendPaymentNotification(
        userId,
        paymentId,
        "payment_failed",
        paymentData
      );

      expect(sendNotificationSpy).toHaveBeenCalledWith({
        userId,
        type: "payment_failed",
        title: "Payment Failed",
        message: `Your payment of ${paymentData.amount} ${paymentData.currency} has failed.`,
        priority: "high",
        metadata: {
          entityType: "payment",
          entityId: paymentId,
          ...paymentData,
        },
        category: "payments",
        tags: ["payment", "payment_failed"],
      });

      sendNotificationSpy.mockRestore();
    });
  });
});
