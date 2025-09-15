import mongoose, { Schema, type Document, type Types } from "mongoose"
import { EventEmitter } from "events"
import { logger } from "../utils/logger"
import { withCache, invalidateCache } from "../db/redis"
import { schedulerService } from "./scheduler.service"

// Define notification status
export enum NotificationStatus {
  UNREAD = "unread",
  READ = "read",
  ARCHIVED = "archived",
}

// Define notification priority
export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

// Define notification type
export enum NotificationType {
  SYSTEM = "system",
  CONTENT = "content",
  WORKFLOW = "workflow",
  USER = "user",
  MEDIA = "media",
  WORKFLOW_ASSIGNMENT = "workflow_assignment",
  WORKFLOW_APPROVAL = "workflow_approval",
  WORKFLOW_NOTIFICATION = "workflow_notification",
  CONTENT_PUBLISHED = "content_published",
  CONTENT_UNPUBLISHED = "content_unpublished",
  CONTENT_UPDATED = "content_updated",
  CONTENT_DELETED = "content_deleted",
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
  MEDIA_UPLOADED = "media_uploaded",
  MEDIA_UPDATED = "media_updated",
  MEDIA_DELETED = "media_deleted",
  CUSTOM = "custom",
}

// Define notification interface
export interface INotification extends Document {
  userId: Types.ObjectId
  type: NotificationType
  title: string
  message: string
  status: NotificationStatus
  priority: NotificationPriority
  data?: Record<string, any>
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
  readAt?: Date
  archivedAt?: Date
  tenantId?: Types.ObjectId
}

// Define notification schema
const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.UNREAD,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM,
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    readAt: Date,
    archivedAt: Date,
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

// Create indexes
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// Create model
export const NotificationModel = mongoose.model<INotification>("Notification", notificationSchema)

// Notification service
export class NotificationService extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100) // Allow more listeners
  }

  /**
   * Send a notification
   */
  public async sendNotification(params: {
    userId: string
    type: NotificationType
    title: string
    message: string
    priority?: NotificationPriority
    data?: Record<string, any>
    expiresAt?: Date
    tenantId?: string
  }): Promise<INotification> {
    try {
      const { userId, type, title, message, priority, data, expiresAt, tenantId } = params

      // Create notification
      const notification = new NotificationModel({
        userId: new mongoose.Types.ObjectId(userId),
        type,
        title,
        message,
        priority: priority || NotificationPriority.MEDIUM,
        data: data || {},
        expiresAt,
        tenantId: tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
      })

      await notification.save()

      // Emit event
      this.emit("notification:sent", notification)

      // Invalidate cache
      await invalidateCache(`notifications:${userId}:*`)

      return notification
    } catch (error) {
      logger.error("Error sending notification:", error)
      throw error
    }
  }

  /**
   * Send notifications to multiple users
   */
  public async sendNotifications(params: {
    userIds: string[]
    type: NotificationType
    title: string
    message: string
    priority?: NotificationPriority
    data?: Record<string, any>
    expiresAt?: Date
    tenantId?: string
  }): Promise<INotification[]> {
    try {
      const { userIds, type, title, message, priority, data, expiresAt, tenantId } = params

      if (!userIds || userIds.length === 0) {
        return []
      }

      // Create notifications
      const notifications = userIds.map(
        (userId) =>
          new NotificationModel({
            userId: new mongoose.Types.ObjectId(userId),
            type,
            title,
            message,
            priority: priority || NotificationPriority.MEDIUM,
            data: data || {},
            expiresAt,
            tenantId: tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
          }),
      )

      // Save all notifications
      const savedNotifications = await NotificationModel.insertMany(notifications)

      // Emit events
      savedNotifications.forEach((notification) => {
        this.emit("notification:sent", notification)
      })

      // Invalidate cache for all users
      await Promise.all(userIds.map((userId) => invalidateCache(`notifications:${userId}:*`)))

      return savedNotifications
    } catch (error) {
      logger.error("Error sending notifications:", error)
      throw error
    }
  }

  /**
   * Get notifications for a user
   */
  public async getUserNotifications(params: {
    userId: string
    status?: NotificationStatus | NotificationStatus[]
    type?: NotificationType | NotificationType[]
    priority?: NotificationPriority | NotificationPriority[]
    page?: number
    limit?: number
    tenantId?: string
  }): Promise<{
    notifications: INotification[]
    total: number
    page: number
    limit: number
    pages: number
  }> {
    try {
      const { userId, status, type, priority, page = 1, limit = 20, tenantId } = params

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
      }

      if (status) {
        query.status = Array.isArray(status) ? { $in: status } : status
      }

      if (type) {
        query.type = Array.isArray(type) ? { $in: type } : type
      }

      if (priority) {
        query.priority = Array.isArray(priority) ? { $in: priority } : priority
      }

      if (tenantId) {
        query.tenantId = new mongoose.Types.ObjectId(tenantId)
      }

      // Cache key
      const cacheKey = `notifications:${userId}:${JSON.stringify({
        status,
        type,
        priority,
        page,
        limit,
        tenantId,
      })}`

      return await withCache(
        cacheKey,
        async () => {
          // Count total
          const total = await NotificationModel.countDocuments(query)

          // Get notifications
          const notifications = await NotificationModel.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)

          return {
            notifications,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          }
        },
        { ttl: 300 }, // Cache for 5 minutes
      )
    } catch (error) {
      logger.error("Error getting user notifications:", error)
      throw error
    }
  }

  /**
   * Get notification by ID
   */
  public async getNotification(id: string): Promise<INotification> {
    try {
      const notification = await NotificationModel.findById(id)
      if (!notification) {
        throw new Error("Notification not found")
      }
      return notification
    } catch (error) {
      logger.error(`Error getting notification ${id}:`, error)
      throw error
    }
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(id: string): Promise<INotification> {
    try {
      const notification = await NotificationModel.findById(id)
      if (!notification) {
        throw new Error("Notification not found")
      }

      notification.status = NotificationStatus.READ
      notification.readAt = new Date()
      await notification.save()

      // Emit event
      this.emit("notification:read", notification)

      // Invalidate cache
      await invalidateCache(`notifications:${notification.userId}:*`)

      return notification
    } catch (error) {
      logger.error(`Error marking notification ${id} as read:`, error)
      throw error
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllAsRead(params: { userId: string; type?: NotificationType; tenantId?: string }): Promise<number> {
    try {
      const { userId, type, tenantId } = params

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
        status: NotificationStatus.UNREAD,
      }

      if (type) {
        query.type = type
      }

      if (tenantId) {
        query.tenantId = new mongoose.Types.ObjectId(tenantId)
      }

      // Update notifications
      const result = await NotificationModel.updateMany(query, {
        $set: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      })

      // Emit event
      this.emit("notification:all_read", { userId, type, tenantId })

      // Invalidate cache
      await invalidateCache(`notifications:${userId}:*`)

      return result.modifiedCount
    } catch (error) {
      logger.error("Error marking all notifications as read:", error)
      throw error
    }
  }

  /**
   * Archive notification
   */
  public async archiveNotification(id: string): Promise<INotification> {
    try {
      const notification = await NotificationModel.findById(id)
      if (!notification) {
        throw new Error("Notification not found")
      }

      notification.status = NotificationStatus.ARCHIVED
      notification.archivedAt = new Date()
      await notification.save()

      // Emit event
      this.emit("notification:archived", notification)

      // Invalidate cache
      await invalidateCache(`notifications:${notification.userId}:*`)

      return notification
    } catch (error) {
      logger.error(`Error archiving notification ${id}:`, error)
      throw error
    }
  }

  /**
   * Archive all notifications for a user
   */
  public async archiveAllNotifications(params: {
    userId: string
    type?: NotificationType
    tenantId?: string
  }): Promise<number> {
    try {
      const { userId, type, tenantId } = params

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $ne: NotificationStatus.ARCHIVED },
      }

      if (type) {
        query.type = type
      }

      if (tenantId) {
        query.tenantId = new mongoose.Types.ObjectId(tenantId)
      }

      // Update notifications
      const result = await NotificationModel.updateMany(query, {
        $set: {
          status: NotificationStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      })

      // Emit event
      this.emit("notification:all_archived", { userId, type, tenantId })

      // Invalidate cache
      await invalidateCache(`notifications:${userId}:*`)

      return result.modifiedCount
    } catch (error) {
      logger.error("Error archiving all notifications:", error)
      throw error
    }
  }

  /**
   * Delete notification
   */
  public async deleteNotification(id: string): Promise<void> {
    try {
      const notification = await NotificationModel.findById(id)
      if (!notification) {
        throw new Error("Notification not found")
      }

      await notification.deleteOne()

      // Emit event
      this.emit("notification:deleted", notification)

      // Invalidate cache
      await invalidateCache(`notifications:${notification.userId}:*`)
    } catch (error) {
      logger.error(`Error deleting notification ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete all notifications for a user
   */
  public async deleteAllNotifications(params: {
    userId: string
    type?: NotificationType
    status?: NotificationStatus
    tenantId?: string
  }): Promise<number> {
    try {
      const { userId, type, status, tenantId } = params

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
      }

      if (type) {
        query.type = type
      }

      if (status) {
        query.status = status
      }

      if (tenantId) {
        query.tenantId = new mongoose.Types.ObjectId(tenantId)
      }

      // Delete notifications
      const result = await NotificationModel.deleteMany(query)

      // Emit event
      this.emit("notification:all_deleted", { userId, type, status, tenantId })

      // Invalidate cache
      await invalidateCache(`notifications:${userId}:*`)

      return result.deletedCount
    } catch (error) {
      logger.error("Error deleting all notifications:", error)
      throw error
    }
  }

  /**
   * Get unread notification count for a user
   */
  public async getUnreadCount(params: { userId: string; type?: NotificationType; tenantId?: string }): Promise<number> {
    try {
      const { userId, type, tenantId } = params

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
        status: NotificationStatus.UNREAD,
      }

      if (type) {
        query.type = type
      }

      if (tenantId) {
        query.tenantId = new mongoose.Types.ObjectId(tenantId)
      }

      // Cache key
      const cacheKey = `notifications:${userId}:unread_count:${JSON.stringify({
        type,
        tenantId,
      })}`

      return await withCache(
        cacheKey,
        async () => {
          return await NotificationModel.countDocuments(query)
        },
        { ttl: 300 }, // Cache for 5 minutes
      )
    } catch (error) {
      logger.error("Error getting unread notification count:", error)
      throw error
    }
  }

  /**
   * Schedule a notification
   */
  public async scheduleNotification(params: {
    userId: string
    type: NotificationType
    title: string
    message: string
    priority?: NotificationPriority
    data?: Record<string, any>
    scheduledFor: Date
    expiresAt?: Date
    tenantId?: string
  }): Promise<void> {
    try {
      const { userId, type, title, message, priority, data, scheduledFor, expiresAt, tenantId } = params

      // Schedule job
      await schedulerService.createJob({
        name: "send_notification",
        type: "scheduled",
        scheduledFor,
        data: {
          userId,
          type,
          title,
          message,
          priority,
          data,
          expiresAt,
          tenantId,
        },
        maxRetries: 3,
      })

      logger.info(`Scheduled notification for user ${userId} at ${scheduledFor}`)
    } catch (error) {
      logger.error("Error scheduling notification:", error)
      throw error
    }
  }

  /**
   * Clean up old notifications
   */
  public async cleanupOldNotifications(params: {
    olderThan: Date
    status?: NotificationStatus
  }): Promise<number> {
    try {
      const { olderThan, status } = params

      // Build query
      const query: any = {
        createdAt: { $lt: olderThan },
      }

      if (status) {
        query.status = status
      }

      // Delete notifications
      const result = await NotificationModel.deleteMany(query)

      logger.info(`Cleaned up ${result.deletedCount} old notifications`)

      return result.deletedCount
    } catch (error) {
      logger.error("Error cleaning up old notifications:", error)
      throw error
    }
  }
}

// Register job handler for sending scheduled notifications
schedulerService.registerJobHandler("send_notification", async (job) => {
  try {
    const { userId, type, title, message, priority, data, expiresAt, tenantId } = job.data

    // Get notification service instance
    const notificationService = new NotificationService()

    // Send notification
    await notificationService.sendNotification({
      userId,
      type,
      title,
      message,
      priority,
      data,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      tenantId,
    })

    return { success: true }
  } catch (error) {
    logger.error("Error sending scheduled notification:", error)
    throw error
  }
})

// Export singleton instance
export const notificationService = new NotificationService()
