import mongoose, { Schema, type Document } from "mongoose"
import { logger } from "../utils/logger"

// Audit log interface
interface IAuditLog extends Document {
  action: string
  entityType: string
  entityId: string
  userId?: string
  userEmail?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

// Audit log schema
const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    userEmail: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  },
)

// Create model
const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", auditLogSchema)

export class AuditService {
  /**
   * Log an audit event
   */
  async log(data: {
    action: string
    entityType: string
    entityId: string
    userId?: string
    userEmail?: string
    details?: any
    ipAddress?: string
    userAgent?: string
  }): Promise<IAuditLog> {
    try {
      const auditLog = new AuditLogModel({
        ...data,
        timestamp: new Date(),
      })

      await auditLog.save()
      return auditLog
    } catch (error) {
      logger.error("Failed to create audit log:", error)
      throw error
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(
    filter: {
      action?: string
      entityType?: string
      entityId?: string
      userId?: string
      userEmail?: string
      startDate?: Date
      endDate?: Date
    } = {},
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    logs: IAuditLog[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    try {
      const page = pagination.page || 1
      const limit = pagination.limit || 20
      const skip = (page - 1) * limit

      // Build query
      const query: any = {}

      if (filter.action) {
        query.action = filter.action
      }

      if (filter.entityType) {
        query.entityType = filter.entityType
      }

      if (filter.entityId) {
        query.entityId = filter.entityId
      }

      if (filter.userId) {
        query.userId = filter.userId
      }

      if (filter.userEmail) {
        query.userEmail = filter.userEmail
      }

      if (filter.startDate || filter.endDate) {
        query.timestamp = {}
        if (filter.startDate) {
          query.timestamp.$gte = filter.startDate
        }
        if (filter.endDate) {
          query.timestamp.$lte = filter.endDate
        }
      }

      // Execute query
      const [logs, totalCount] = await Promise.all([
        AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
        AuditLogModel.countDocuments(query),
      ])

      const totalPages = Math.ceil(totalCount / limit)

      return {
        logs,
        totalCount,
        page,
        totalPages,
      }
    } catch (error) {
      logger.error("Failed to get audit logs:", error)
      throw error
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditLogs(
    entityType: string,
    entityId: string,
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    logs: IAuditLog[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    return this.getAuditLogs(
      {
        entityType,
        entityId,
      },
      pagination,
    )
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    userId: string,
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    logs: IAuditLog[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    return this.getAuditLogs(
      {
        userId,
      },
      pagination,
    )
  }

  /**
   * Get recent audit logs
   */
  async getRecentAuditLogs(limit = 20): Promise<IAuditLog[]> {
    try {
      return AuditLogModel.find().sort({ timestamp: -1 }).limit(limit)
    } catch (error) {
      logger.error("Failed to get recent audit logs:", error)
      throw error
    }
  }

  /**
   * Delete old audit logs
   */
  async deleteOldAuditLogs(olderThan: Date): Promise<number> {
    try {
      const result = await AuditLogModel.deleteMany({
        timestamp: { $lt: olderThan },
      })

      return result.deletedCount || 0
    } catch (error) {
      logger.error("Failed to delete old audit logs:", error)
      throw error
    }
  }
}

// Export singleton instance
export const auditService = new AuditService()
