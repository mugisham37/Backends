import type { Request, Response } from "express"
import prisma from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import redisClient from "../utils/redis-client"
import { logger } from "../utils/logger"

// Create a new analytics event
export const createEvent = async (req: Request, res: Response) => {
  try {
    const { name, properties } = req.body
    const tenantId = req.headers["x-tenant-id"] as string
    const userId = req.user?.id

    const event = await prisma.analyticsEvent.create({
      data: {
        name,
        properties,
        tenantId,
        userId,
      },
    })

    // Increment event count in Redis for real-time stats
    await redisClient.hincrby(`tenant:${tenantId}:events:count`, name, 1)

    res.status(201).json({
      status: "success",
      data: event,
    })
  } catch (error) {
    logger.error("Error creating analytics event:", error)
    throw new ApiError(500, "Failed to create analytics event")
  }
}

// Get events with optional filtering
export const getEvents = async (req: Request, res: Response) => {
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

    const events = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 1000, // Limit to prevent excessive data transfer
    })

    res.status(200).json({
      status: "success",
      data: events,
    })
  } catch (error) {
    logger.error("Error fetching analytics events:", error)
    throw new ApiError(500, "Failed to fetch analytics events")
  }
}

// Get a specific event by ID
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    const event = await prisma.analyticsEvent.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!event) {
      throw new ApiError(404, "Analytics event not found")
    }

    res.status(200).json({
      status: "success",
      data: event,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching analytics event:", error)
    throw new ApiError(500, "Failed to fetch analytics event")
  }
}

// Delete an event
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    // Check if event exists and belongs to tenant
    const event = await prisma.analyticsEvent.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!event) {
      throw new ApiError(404, "Analytics event not found")
    }

    // Delete the event
    await prisma.analyticsEvent.delete({
      where: { id },
    })

    res.status(200).json({
      status: "success",
      message: "Analytics event deleted successfully",
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error deleting analytics event:", error)
    throw new ApiError(500, "Failed to delete analytics event")
  }
}
