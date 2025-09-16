import type { Request, Response } from "express"
import prisma from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import redisClient from "../utils/redis-client"
import { logger } from "../utils/logger"

// Create a new analytics metric
export const createMetric = async (req: Request, res: Response) => {
  try {
    const { name, value, unit } = req.body
    const tenantId = req.headers["x-tenant-id"] as string

    const metric = await prisma.analyticsMetric.create({
      data: {
        name,
        value,
        unit,
        tenantId,
      },
    })

    // Store latest metric value in Redis for real-time access
    await redisClient.hset(`tenant:${tenantId}:metrics:latest`, name, value.toString())

    res.status(201).json({
      status: "success",
      data: metric,
    })
  } catch (error) {
    logger.error("Error creating analytics metric:", error)
    throw new ApiError(500, "Failed to create analytics metric")
  }
}

// Get metrics with optional filtering
export const getMetrics = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string
    const { startDate, endDate, name } = req.query

    // Build filter conditions
    const where: any = { tenantId }

    if (name) {
      where.name = name
    }

    if (startDate || endDate) {
      where.timestamp = {}

      if (startDate) {
        where.timestamp.gte = new Date(startDate as string)
      }

      if (endDate) {
        where.timestamp.lte = new Date(endDate as string)
      }
    }

    const metrics = await prisma.analyticsMetric.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 1000, // Limit to prevent excessive data transfer
    })

    res.status(200).json({
      status: "success",
      data: metrics,
    })
  } catch (error) {
    logger.error("Error fetching analytics metrics:", error)
    throw new ApiError(500, "Failed to fetch analytics metrics")
  }
}

// Get a specific metric by ID
export const getMetricById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    const metric = await prisma.analyticsMetric.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!metric) {
      throw new ApiError(404, "Analytics metric not found")
    }

    res.status(200).json({
      status: "success",
      data: metric,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching analytics metric:", error)
    throw new ApiError(500, "Failed to fetch analytics metric")
  }
}

// Delete a metric
export const deleteMetric = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    // Check if metric exists and belongs to tenant
    const metric = await prisma.analyticsMetric.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!metric) {
      throw new ApiError(404, "Analytics metric not found")
    }

    // Delete the metric
    await prisma.analyticsMetric.delete({
      where: { id },
    })

    res.status(200).json({
      status: "success",
      message: "Analytics metric deleted successfully",
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error deleting analytics metric:", error)
    throw new ApiError(500, "Failed to delete analytics metric")
  }
}
