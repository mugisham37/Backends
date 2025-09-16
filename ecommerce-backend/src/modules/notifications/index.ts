/**
 * Notifications Module Index
 * Exports all notification-related services and components
 */

import { WebSocketService, websocketService } from "./websocket.service.js";
import { EmailService } from "./email.service.js";
import { NotificationService } from "./notification.service.js";
import { RealtimeNotificationService } from "./realtime-notification.service.js";
import { NotificationController } from "./notification.controller.js";

export {
  WebSocketService,
  websocketService,
  EmailService,
  NotificationService,
  RealtimeNotificationService,
  NotificationController,
};

// Re-export types
export type {
  WebSocketUser,
  AuthenticatedWebSocket,
  WebSocketMessage,
  ConnectionStats,
} from "./websocket.service.js";

export type {
  EmailConfig,
  EmailTemplate,
  SendEmailOptions,
  EmailData,
} from "./email.service.js";

export type {
  NotificationConfig,
  EmailJobData,
  BulkEmailJobData,
  NotificationJobData,
} from "./notification.service.js";

export type {
  NotificationPayload,
  BulkNotificationPayload,
  NotificationDeliveryResult,
} from "./realtime-notification.service.js";

// Factory function to create notification services
export function createNotificationServices(dependencies: {
  db: any; // Database connection
  redis: any; // Redis connection
  emailConfig: any;
  notificationConfig: any;
}) {
  const { db, emailConfig, notificationConfig } = dependencies;

  // Create email service
  const emailService = new EmailService(emailConfig);

  // Create notification queue service
  const notificationService = new NotificationService(
    emailService,
    notificationConfig
  );

  // Create WebSocket service
  const websocketServiceInstance = new WebSocketService();

  // Create notification repository
  const NotificationRepository =
    require("../../core/repositories/notification.repository.js").NotificationRepository;
  const notificationRepo = new NotificationRepository(db);

  // Create real-time notification service
  const realtimeNotificationService = new RealtimeNotificationService(
    notificationRepo,
    websocketServiceInstance,
    emailService,
    notificationService
  );

  // Create controller
  const notificationController = new NotificationController(
    realtimeNotificationService
  );

  return {
    emailService,
    notificationService,
    websocketService: websocketServiceInstance,
    realtimeNotificationService,
    notificationController,
    notificationRepo,
  };
}

// Default export for convenience
export default {
  WebSocketService,
  EmailService,
  NotificationService,
  RealtimeNotificationService,
  NotificationController,
  createNotificationServices,
};
