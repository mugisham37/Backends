/**
 * Notifications Module Index
 * Exports all notification-related services and components
 */

export { WebSocketService, websocketService } from "./websocket.service.js";
export { EmailService } from "./email.service.js";
export { NotificationService } from "./notification.service.js";
export { RealtimeNotificationService } from "./realtime-notification.service.js";
export { NotificationController } from "./notification.controller.js";

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
  const { db, redis, emailConfig, notificationConfig } = dependencies;

  // Create email service
  const emailService = new EmailService(emailConfig);

  // Create notification queue service
  const notificationService = new NotificationService(
    emailService,
    notificationConfig
  );

  // Create WebSocket service
  const websocketService = new WebSocketService();

  // Create notification repository
  const NotificationRepository =
    require("../../core/repositories/notification.repository.js").NotificationRepository;
  const notificationRepo = new NotificationRepository(db);

  // Create real-time notification service
  const realtimeNotificationService = new RealtimeNotificationService(
    notificationRepo,
    websocketService,
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
    websocketService,
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
