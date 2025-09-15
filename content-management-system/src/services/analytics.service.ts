import { ContentModel } from "../db/models/content.model"
import { MediaModel } from "../db/models/media.model"
import { UserModel } from "../db/models/user.model"
import { WebhookDeliveryModel } from "../db/models/webhook.model"
import { WorkflowEntryModel } from "../db/models/workflow.model"
import { cacheService } from "./cache.service"
import { logger } from "../utils/logger"

export class AnalyticsService {
  /**
   * Get system overview statistics
   */
  async getSystemOverview(): Promise<any> {
    // Try to get from cache first
    const cacheKey = "analytics:system-overview"
    const cachedData = await cacheService.get<any>(cacheKey)

    if (cachedData) {
      return cachedData
    }

    try {
      // Run aggregations in parallel for better performance
      const [contentStats, mediaStats, userStats, webhookStats, workflowStats] = await Promise.all([
        this.getContentStats(),
        this.getMediaStats(),
        this.getUserStats(),
        this.getWebhookStats(),
        this.getWorkflowStats(),
      ])

      const result = {
        content: contentStats,
        media: mediaStats,
        users: userStats,
        webhooks: webhookStats,
        workflows: workflowStats,
        timestamp: new Date(),
      }

      // Cache the result for 5 minutes
      await cacheService.set(cacheKey, result, 300)

      return result
    } catch (error) {
      logger.error("Error getting system overview:", error)
      throw error
    }
  }

  /**
   * Get content statistics
   */
  async getContentStats(): Promise<any> {
    try {
      const [totalCount, statusCounts, recentActivity] = await Promise.all([
        // Total count
        ContentModel.countDocuments(),

        // Count by status
        ContentModel.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        // Recent activity
        ContentModel.aggregate([
          { $sort: { updatedAt: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "users",
              localField: "updatedBy",
              foreignField: "_id",
              as: "updatedByUser",
            },
          },
          {
            $project: {
              _id: 1,
              status: 1,
              updatedAt: 1,
              "updatedByUser.firstName": 1,
              "updatedByUser.lastName": 1,
            },
          },
        ]),
      ])

      // Format status counts
      const formattedStatusCounts: Record<string, number> = {}
      statusCounts.forEach((item: any) => {
        formattedStatusCounts[item._id] = item.count
      })

      return {
        totalCount,
        byStatus: formattedStatusCounts,
        recentActivity,
      }
    } catch (error) {
      logger.error("Error getting content stats:", error)
      throw error
    }
  }

  /**
   * Get media statistics
   */
  async getMediaStats(): Promise<any> {
    try {
      const [totalCount, typeCounts, totalSize, recentUploads] = await Promise.all([
        // Total count
        MediaModel.countDocuments(),

        // Count by type
        MediaModel.aggregate([
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
            },
          },
        ]),

        // Total size
        MediaModel.aggregate([
          {
            $group: {
              _id: null,
              totalSize: { $sum: "$size" },
            },
          },
        ]),

        // Recent uploads
        MediaModel.aggregate([
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdByUser",
            },
          },
          {
            $project: {
              _id: 1,
              filename: 1,
              type: 1,
              size: 1,
              createdAt: 1,
              "createdByUser.firstName": 1,
              "createdByUser.lastName": 1,
            },
          },
        ]),
      ])

      // Format type counts
      const formattedTypeCounts: Record<string, number> = {}
      typeCounts.forEach((item: any) => {
        formattedTypeCounts[item._id] = item.count
      })

      return {
        totalCount,
        byType: formattedTypeCounts,
        totalSize: totalSize.length > 0 ? totalSize[0].totalSize : 0,
        recentUploads,
      }
    } catch (error) {
      logger.error("Error getting media stats:", error)
      throw error
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<any> {
    try {
      const [totalCount, roleCounts, activeInactiveCount, recentLogins] = await Promise.all([
        // Total count
        UserModel.countDocuments(),

        // Count by role
        UserModel.aggregate([
          {
            $group: {
              _id: "$role",
              count: { $sum: 1 },
            },
          },
        ]),

        // Active vs inactive
        UserModel.aggregate([
          {
            $group: {
              _id: "$isActive",
              count: { $sum: 1 },
            },
          },
        ]),

        // Recent logins
        UserModel.aggregate([
          { $match: { lastLogin: { $exists: true } } },
          { $sort: { lastLogin: -1 } },
          { $limit: 10 },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              role: 1,
              lastLogin: 1,
            },
          },
        ]),
      ])

      // Format role counts
      const formattedRoleCounts: Record<string, number> = {}
      roleCounts.forEach((item: any) => {
        formattedRoleCounts[item._id] = item.count
      })

      // Format active/inactive counts
      const activeCount = activeInactiveCount.find((item: any) => item._id === true)?.count || 0
      const inactiveCount = activeInactiveCount.find((item: any) => item._id === false)?.count || 0

      return {
        totalCount,
        byRole: formattedRoleCounts,
        activeCount,
        inactiveCount,
        recentLogins,
      }
    } catch (error) {
      logger.error("Error getting user stats:", error)
      throw error
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(): Promise<any> {
    try {
      const [deliveryStats, recentDeliveries] = await Promise.all([
        // Delivery stats
        WebhookDeliveryModel.aggregate([
          {
            $group: {
              _id: "$success",
              count: { $sum: 1 },
            },
          },
        ]),

        // Recent deliveries
        WebhookDeliveryModel.aggregate([
          { $sort: { timestamp: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "webhooks",
              localField: "webhook",
              foreignField: "_id",
              as: "webhookInfo",
            },
          },
          {
            $project: {
              _id: 1,
              success: 1,
              statusCode: 1,
              timestamp: 1,
              "webhookInfo.name": 1,
              "webhookInfo.url": 1,
            },
          },
        ]),
      ])

      // Format delivery stats
      const successCount = deliveryStats.find((item: any) => item._id === true)?.count || 0
      const failureCount = deliveryStats.find((item: any) => item._id === false)?.count || 0
      const totalCount = successCount + failureCount
      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0

      return {
        totalDeliveries: totalCount,
        successCount,
        failureCount,
        successRate,
        recentDeliveries,
      }
    } catch (error) {
      logger.error("Error getting webhook stats:", error)
      throw error
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<any> {
    try {
      const [statusCounts, recentEntries] = await Promise.all([
        // Count by status
        WorkflowEntryModel.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        // Recent entries
        WorkflowEntryModel.aggregate([
          { $sort: { updatedAt: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "workflows",
              localField: "workflow",
              foreignField: "_id",
              as: "workflowInfo",
            },
          },
          {
            $lookup: {
              from: "contents",
              localField: "content",
              foreignField: "_id",
              as: "contentInfo",
            },
          },
          {
            $project: {
              _id: 1,
              status: 1,
              updatedAt: 1,
              "workflowInfo.name": 1,
              "contentInfo._id": 1,
            },
          },
        ]),
      ])

      // Format status counts
      const formattedStatusCounts: Record<string, number> = {}
      statusCounts.forEach((item: any) => {
        formattedStatusCounts[item._id] = item.count
      })

      const totalCount = statusCounts.reduce((sum: number, item: any) => sum + item.count, 0)

      return {
        totalCount,
        byStatus: formattedStatusCounts,
        recentEntries,
      }
    } catch (error) {
      logger.error("Error getting workflow stats:", error)
      throw error
    }
  }

  /**
   * Get content creation over time
   */
  async getContentCreationOverTime(period: "day" | "week" | "month" = "day", limit = 30): Promise<any> {
    try {
      let groupByFormat: string
      let dateFormat: string

      switch (period) {
        case "day":
          groupByFormat = "%Y-%m-%d"
          dateFormat = '$dateToString: { format: "%Y-%m-%d", date: "$createdAt" }'
          break
        case "week":
          groupByFormat = "%G-W%V" // ISO week format
          dateFormat = '$concat: [{ $dateToString: { format: "%G-W%V", date: "$createdAt" } }]'
          break
        case "month":
          groupByFormat = "%Y-%m"
          dateFormat = '$dateToString: { format: "%Y-%m", date: "$createdAt" }'
          break
        default:
          groupByFormat = "%Y-%m-%d"
          dateFormat = '$dateToString: { format: "%Y-%m-%d", date: "$createdAt" }'
      }

      const pipeline = [
        {
          $group: {
            _id: {
              $dateToString: { format: groupByFormat, date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: limit },
        { $sort: { _id: 1 } },
      ]

      const results = await ContentModel.aggregate(pipeline)

      return {
        period,
        data: results.map((item: any) => ({
          date: item._id,
          count: item.count,
        })),
      }
    } catch (error) {
      logger.error("Error getting content creation over time:", error)
      throw error
    }
  }

  /**
   * Get user activity over time
   */
  async getUserActivityOverTime(period: "day" | "week" | "month" = "day", limit = 30): Promise<any> {
    try {
      let groupByFormat: string

      switch (period) {
        case "day":
          groupByFormat = "%Y-%m-%d"
          break
        case "week":
          groupByFormat = "%G-W%V" // ISO week format
          break
        case "month":
          groupByFormat = "%Y-%m"
          break
        default:
          groupByFormat = "%Y-%m-%d"
      }

      const pipeline = [
        { $match: { lastLogin: { $exists: true } } },
        {
          $group: {
            _id: {
              $dateToString: { format: groupByFormat, date: "$lastLogin" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: limit },
        { $sort: { _id: 1 } },
      ]

      const results = await UserModel.aggregate(pipeline)

      return {
        period,
        data: results.map((item: any) => ({
          date: item._id,
          count: item.count,
        })),
      }
    } catch (error) {
      logger.error("Error getting user activity over time:", error)
      throw error
    }
  }

  /**
   * Get content by status distribution
   */
  async getContentStatusDistribution(): Promise<any> {
    try {
      const results = await ContentModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ])

      return results.map((item: any) => ({
        status: item._id,
        count: item.count,
      }))
    } catch (error) {
      logger.error("Error getting content status distribution:", error)
      throw error
    }
  }

  /**
   * Get media type distribution
   */
  async getMediaTypeDistribution(): Promise<any> {
    try {
      const results = await MediaModel.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalSize: { $sum: "$size" },
          },
        },
      ])

      return results.map((item: any) => ({
        type: item._id,
        count: item.count,
        totalSize: item.totalSize,
      }))
    } catch (error) {
      logger.error("Error getting media type distribution:", error)
      throw error
    }
  }

  /**
   * Get user role distribution
   */
  async getUserRoleDistribution(): Promise<any> {
    try {
      const results = await UserModel.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ])

      return results.map((item: any) => ({
        role: item._id,
        count: item.count,
      }))
    } catch (error) {
      logger.error("Error getting user role distribution:", error)
      throw error
    }
  }

  /**
   * Get top content creators
   */
  async getTopContentCreators(limit = 10): Promise<any> {
    try {
      const results = await ContentModel.aggregate([
        { $match: { createdBy: { $exists: true } } },
        {
          $group: {
            _id: "$createdBy",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            "userInfo.firstName": 1,
            "userInfo.lastName": 1,
            "userInfo.email": 1,
          },
        },
      ])

      return results.map((item: any) => ({
        userId: item._id,
        count: item.count,
        user:
          item.userInfo.length > 0
            ? {
                firstName: item.userInfo[0].firstName,
                lastName: item.userInfo[0].lastName,
                email: item.userInfo[0].email,
              }
            : null,
      }))
    } catch (error) {
      logger.error("Error getting top content creators:", error)
      throw error
    }
  }

  /**
   * Get webhook success rate over time
   */
  async getWebhookSuccessRateOverTime(period: "day" | "week" | "month" = "day", limit = 30): Promise<any> {
    try {
      let groupByFormat: string

      switch (period) {
        case "day":
          groupByFormat = "%Y-%m-%d"
          break
        case "week":
          groupByFormat = "%G-W%V" // ISO week format
          break
        case "month":
          groupByFormat = "%Y-%m"
          break
        default:
          groupByFormat = "%Y-%m-%d"
      }

      const pipeline = [
        {
          $group: {
            _id: {
              date: { $dateToString: { format: groupByFormat, date: "$timestamp" } },
              success: "$success",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            total: { $sum: "$count" },
            success: {
              $sum: {
                $cond: [{ $eq: ["$_id.success", true] }, "$count", 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            total: 1,
            success: 1,
            rate: {
              $cond: [{ $eq: ["$total", 0] }, 0, { $multiply: [{ $divide: ["$success", "$total"] }, 100] }],
            },
          },
        },
        { $sort: { date: -1 } },
        { $limit: limit },
        { $sort: { date: 1 } },
      ]

      const results = await WebhookDeliveryModel.aggregate(pipeline)

      return {
        period,
        data: results,
      }
    } catch (error) {
      logger.error("Error getting webhook success rate over time:", error)
      throw error
    }
  }

  /**
   * Get workflow completion statistics
   */
  async getWorkflowCompletionStats(): Promise<any> {
    try {
      const results = await WorkflowEntryModel.aggregate([
        {
          $group: {
            _id: {
              workflow: "$workflow",
              status: "$status",
            },
            count: { $sum: 1 },
            avgDuration: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", ["approved", "rejected", "canceled"]] },
                      { $ne: ["$updatedAt", null] },
                      { $ne: ["$createdAt", null] },
                    ],
                  },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "workflows",
            localField: "_id.workflow",
            foreignField: "_id",
            as: "workflowInfo",
          },
        },
        {
          $project: {
            _id: 0,
            workflowId: "$_id.workflow",
            workflowName: { $arrayElemAt: ["$workflowInfo.name", 0] },
            status: "$_id.status",
            count: 1,
            avgDurationMs: "$avgDuration",
          },
        },
        { $sort: { workflowName: 1, status: 1 } },
      ])

      // Group by workflow
      const workflowMap = new Map()

      results.forEach((item: any) => {
        if (!workflowMap.has(item.workflowId)) {
          workflowMap.set(item.workflowId, {
            workflowId: item.workflowId,
            workflowName: item.workflowName,
            statuses: {},
          })
        }

        const workflow = workflowMap.get(item.workflowId)
        workflow.statuses[item.status] = {
          count: item.count,
          avgDurationMs: item.avgDurationMs,
        }
      })

      return Array.from(workflowMap.values())
    } catch (error) {
      logger.error("Error getting workflow completion stats:", error)
      throw error
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService()
