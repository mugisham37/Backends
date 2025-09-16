/**
 * Notification REST API Routes
 * Defines HTTP endpoints for notification management
 */

import { Router } from "express";
import { NotificationController } from "../../../modules/notifications/notification.controller.js";
import { authMiddleware } from "../../../shared/middleware/auth.middleware.js";
import { rateLimitMiddleware } from "../../../shared/middleware/rate-limit.middleware.js";

export function createNotificationRoutes(
  notificationController: NotificationController
): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authMiddleware);

  // Apply rate limiting
  router.use(
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: "Too many notification requests, please try again later",
    })
  );

  /**
   * @route GET /api/notifications
   * @desc Get user notifications with filtering and pagination
   * @access Private
   * @query {number} limit - Number of notifications to return (default: 20, max: 100)
   * @query {number} offset - Number of notifications to skip (default: 0)
   * @query {string} type - Filter by notification type
   * @query {boolean} isRead - Filter by read status
   * @query {string} category - Filter by category
   * @query {string} priority - Filter by priority (low, normal, high, urgent)
   * @query {string} dateFrom - Filter notifications from this date (ISO string)
   * @query {string} dateTo - Filter notifications to this date (ISO string)
   */
  router.get(
    "/",
    notificationController.getNotifications.bind(notificationController)
  );

  /**
   * @route GET /api/notifications/stats
   * @desc Get notification statistics for the user
   * @access Private
   */
  router.get(
    "/stats",
    notificationController.getNotificationStats.bind(notificationController)
  );

  /**
   * @route PUT /api/notifications/read
   * @desc Mark notifications as read
   * @access Private
   * @body {string[]} notificationIds - Array of notification IDs to mark as read (optional, if empty marks all as read)
   */
  router.put(
    "/read",
    notificationController.markAsRead.bind(notificationController)
  );

  /**
   * @route GET /api/notifications/preferences
   * @desc Get user notification preferences
   * @access Private
   */
  router.get(
    "/preferences",
    notificationController.getPreferences.bind(notificationController)
  );

  /**
   * @route PUT /api/notifications/preferences
   * @desc Update user notification preferences
   * @access Private
   * @body {object} preferences - Notification preferences object
   */
  router.put(
    "/preferences",
    notificationController.updatePreferences.bind(notificationController)
  );

  // Admin routes
  /**
   * @route POST /api/notifications/send
   * @desc Send a notification (admin/moderator only)
   * @access Private (Admin/Moderator)
   * @body {object} notification - Notification payload
   */
  router.post(
    "/send",
    notificationController.sendNotification.bind(notificationController)
  );

  /**
   * @route POST /api/notifications/send-bulk
   * @desc Send bulk notifications (admin/moderator only)
   * @access Private (Admin/Moderator)
   * @body {object} bulkNotification - Bulk notification payload
   */
  router.post(
    "/send-bulk",
    notificationController.sendBulkNotification.bind(notificationController)
  );

  // Development/testing routes
  if (process.env.NODE_ENV !== "production") {
    /**
     * @route POST /api/notifications/test
     * @desc Send a test notification (development only)
     * @access Private
     */
    router.post(
      "/test",
      notificationController.testNotification.bind(notificationController)
    );
  }

  return router;
}

export default createNotificationRoutes;
