import { Router } from "express"
import { NotificationController } from "../../../controllers/notification.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { notificationValidation } from "../../../validations/notification.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const notificationController = new NotificationController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get notifications for the current user
router.get("/", notificationController.getUserNotifications)

// Get notification by ID
router.get("/:id", notificationController.getNotification)

// Mark notification as read
router.post("/:id/read", notificationController.markAsRead)

// Mark all notifications as read
router.post("/read-all", notificationController.markAllAsRead)

// Archive notification
router.post("/:id/archive", notificationController.archiveNotification)

// Archive all notifications
router.post("/archive-all", notificationController.archiveAllNotifications)

// Delete notification
router.delete("/:id", notificationController.deleteNotification)

// Delete all notifications
router.delete("/", notificationController.deleteAllNotifications)

// Get unread notification count
router.get("/count/unread", notificationController.getUnreadCount)

// Admin routes
// Send notification
router.post(
  "/send",
  requireRoles(["admin"]),
  validateRequest(notificationValidation.sendNotification),
  notificationController.sendNotification,
)

// Send notifications to multiple users
router.post(
  "/send-multiple",
  requireRoles(["admin"]),
  validateRequest(notificationValidation.sendNotifications),
  notificationController.sendNotifications,
)

// Schedule notification
router.post(
  "/schedule",
  requireRoles(["admin"]),
  validateRequest(notificationValidation.scheduleNotification),
  notificationController.scheduleNotification,
)

// Clean up old notifications
router.post(
  "/cleanup",
  requireRoles(["admin"]),
  validateRequest(notificationValidation.cleanupOldNotifications),
  notificationController.cleanupOldNotifications,
)

export const notificationRoutes = router
