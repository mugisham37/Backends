import type { Request, Response, NextFunction } from "express"
import {
  notificationService,
  type NotificationStatus,
  type NotificationType,
  type NotificationPriority,
} from "../services/notification.service"
import { ApiError } from "../utils/errors"

export class NotificationController {
  /**
   * Get notifications for the current user
   */
  public getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const { status, type, priority, page, limit } = req.query as any

      // Parse status
      let parsedStatus: NotificationStatus[] | undefined
      if (status) {
        parsedStatus = Array.isArray(status) ? status : [status]
      }

      // Parse type
      let parsedType: NotificationType[] | undefined
      if (type) {
        parsedType = Array.isArray(type) ? type : [type]
      }

      // Parse priority
      let parsedPriority: NotificationPriority[] | undefined
      if (priority) {
        parsedPriority = Array.isArray(priority) ? priority : [priority]
      }

      const result = await notificationService.getUserNotifications({
        userId,
        status: parsedStatus,
        type: parsedType,
        priority: parsedPriority,
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get notification by ID
   */
  public getNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const userId = (req as any).user.id

      const notification = await notificationService.getNotification(id)

      // Check if notification belongs to the current user
      if (notification.userId.toString() !== userId) {
        throw ApiError.forbidden("You do not have permission to access this notification")
      }

      res.status(200).json({
        status: "success",
        data: {
          notification,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Mark notification as read
   */
  public markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const userId = (req as any).user.id

      const notification = await notificationService.getNotification(id)

      // Check if notification belongs to the current user
      if (notification.userId.toString() !== userId) {
        throw ApiError.forbidden("You do not have permission to access this notification")
      }

      const updatedNotification = await notificationService.markAsRead(id)

      res.status(200).json({
        status: "success",
        data: {
          notification: updatedNotification,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const { type } = req.query as any

      const count = await notificationService.markAllAsRead({
        userId,
        type,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          count,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Archive notification
   */
  public archiveNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const userId = (req as any).user.id

      const notification = await notificationService.getNotification(id)

      // Check if notification belongs to the current user
      if (notification.userId.toString() !== userId) {
        throw ApiError.forbidden("You do not have permission to access this notification")
      }

      const updatedNotification = await notificationService.archiveNotification(id)

      res.status(200).json({
        status: "success",
        data: {
          notification: updatedNotification,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Archive all notifications
   */
  public archiveAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const { type } = req.query as any

      const count = await notificationService.archiveAllNotifications({
        userId,
        type,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          count,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete notification
   */
  public deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const userId = (req as any).user.id

      const notification = await notificationService.getNotification(id)

      // Check if notification belongs to the current user
      if (notification.userId.toString() !== userId) {
        throw ApiError.forbidden("You do not have permission to access this notification")
      }

      await notificationService.deleteNotification(id)

      res.status(200).json({
        status: "success",
        message: "Notification deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete all notifications
   */
  public deleteAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const { type, status } = req.query as any

      const count = await notificationService.deleteAllNotifications({
        userId,
        type,
        status,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          count,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get unread notification count
   */
  public getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const { type } = req.query as any

      const count = await notificationService.getUnreadCount({
        userId,
        type,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          count,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Send notification (admin only)
   */
  public sendNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, type, title, message, priority, data, expiresAt } = req.body

      const notification = await notificationService.sendNotification({
        userId,
        type,
        title,
        message,
        priority,
        data,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        tenantId: (req as any).tenantId,
      })

      res.status(201).json({
        status: "success",
        data: {
          notification,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Send notifications to multiple users (admin only)
   */
  public sendNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds, type, title, message, priority, data, expiresAt } = req.body

      const notifications = await notificationService.sendNotifications({
        userIds,
        type,
        title,
        message,
        priority,
        data,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        tenantId: (req as any).tenantId,
      })

      res.status(201).json({
        status: "success",
        data: {
          count: notifications.length,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Schedule notification (admin only)
   */
  public scheduleNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, type, title, message, priority, data, scheduledFor, expiresAt } = req.body

      await notificationService.scheduleNotification({
        userId,
        type,
        title,
        message,
        priority,
        data,
        scheduledFor: new Date(scheduledFor),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        tenantId: (req as any).tenantId,
      })

      res.status(201).json({
        status: "success",
        message: "Notification scheduled successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clean up old notifications (admin only)
   */
  public cleanupOldNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { olderThan, status } = req.body

      const count = await notificationService.cleanupOldNotifications({
        olderThan: new Date(olderThan),
        status,
      })

      res.status(200).json({
        status: "success",
        data: {
          count,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
