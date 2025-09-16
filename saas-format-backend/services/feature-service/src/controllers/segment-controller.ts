import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import redisClient from "../utils/redis-client"
import { z } from "zod"

// Validation schemas
const createSegmentSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  rules: z.any().optional(),
})

const updateSegmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  rules: z.any().optional(),
})

export class SegmentController {
  // Get all segments
  async getAllSegments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 20
      const skip = (page - 1) * limit

      // Get segments with pagination
      const [segments, total] = await Promise.all([
        prisma.segment.findMany({
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.segment.count(),
      ])

      res.status(200).json({
        status: "success",
        results: segments.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: segments,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get segment by ID
  async getSegmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const segment = await prisma.segment.findUnique({
        where: { id },
      })

      if (!segment) {
        throw new ApiError(404, "Segment not found")
      }

      res.status(200).json({
        status: "success",
        data: segment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get segment by key
  async getSegmentByKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params

      const segment = await prisma.segment.findUnique({
        where: { key },
      })

      if (!segment) {
        throw new ApiError(404, "Segment not found")
      }

      res.status(200).json({
        status: "success",
        data: segment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create segment
  async createSegment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      // Validate request body
      const validatedData = createSegmentSchema.parse(req.body)

      // Check if segment with key already exists
      const existingSegment = await prisma.segment.findUnique({
        where: { key: validatedData.key },
      })

      if (existingSegment) {
        throw new ApiError(400, "Segment with this key already exists")
      }

      // Create segment
      const segment = await prisma.segment.create({
        data: {
          ...validatedData,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      })

      // Log segment creation
      await prisma.featureFlagAuditLog.create({
        data: {
          action: "segment_created",
          performedBy: req.user.id,
          details: {
            key: segment.key,
            name: segment.name,
          },
        },
      })

      // Publish segment created event
      await sendMessage("feature-events", {
        type: "SEGMENT_CREATED",
        data: {
          id: segment.id,
          key: segment.key,
          name: segment.name,
          createdAt: segment.createdAt,
          createdBy: segment.createdBy,
        },
      })

      // Clear cache
      await redisClient.del(`segments:all`)

      logger.info(`Segment created: ${segment.id} (${segment.key})`)

      res.status(201).json({
        status: "success",
        data: segment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update segment
  async updateSegment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Validate request body
      const validatedData = updateSegmentSchema.parse(req.body)

      // Check if segment exists
      const existingSegment = await prisma.segment.findUnique({
        where: { id },
      })

      if (!existingSegment) {
        throw new ApiError(404, "Segment not found")
      }

      // Update segment
      const updatedSegment = await prisma.segment.update({
        where: { id },
        data: {
          ...validatedData,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
      })

      // Log segment update
      await prisma.featureFlagAuditLog.create({
        data: {
          action: "segment_updated",
          performedBy: req.user.id,
          details: {
            key: updatedSegment.key,
            name: updatedSegment.name,
            before: {
              name: existingSegment.name,
              description: existingSegment.description,
              rules: existingSegment.rules,
            },
            after: {
              name: updatedSegment.name,
              description: updatedSegment.description,
              rules: updatedSegment.rules,
            },
          },
        },
      })

      // Publish segment updated event
      await sendMessage("feature-events", {
        type: "SEGMENT_UPDATED",
        data: {
          id: updatedSegment.id,
          key: updatedSegment.key,
          name: updatedSegment.name,
          updatedAt: updatedSegment.updatedAt,
          updatedBy: updatedSegment.updatedBy,
        },
      })

      // Clear cache
      await redisClient.del(`segments:all`)
      await redisClient.del(`segment:${id}`)
      await redisClient.del(`segment:${existingSegment.key}`)

      logger.info(`Segment updated: ${updatedSegment.id} (${updatedSegment.key})`)

      res.status(200).json({
        status: "success",
        data: updatedSegment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete segment
  async deleteSegment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Check if segment exists
      const existingSegment = await prisma.segment.findUnique({
        where: { id },
      })

      if (!existingSegment) {
        throw new ApiError(404, "Segment not found")
      }

      // Check if segment is used in any feature flags
      const featureFlagSegments = await prisma.featureFlagSegment.findMany({
        where: {
          segmentId: id,
        },
      })

      if (featureFlagSegments.length > 0) {
        throw new ApiError(400, "Cannot delete segment that is used in feature flags")
      }

      // Log segment deletion before actual deletion
      await prisma.featureFlagAuditLog.create({
        data: {
          action: "segment_deleted",
          performedBy: req.user.id,
          details: {
            key: existingSegment.key,
            name: existingSegment.name,
          },
        },
      })

      // Publish segment deleted event
      await sendMessage("feature-events", {
        type: "SEGMENT_DELETED",
        data: {
          id: existingSegment.id,
          key: existingSegment.key,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.id,
        },
      })

      // Delete segment
      await prisma.segment.delete({
        where: { id },
      })

      // Clear cache
      await redisClient.del(`segments:all`)
      await redisClient.del(`segment:${id}`)
      await redisClient.del(`segment:${existingSegment.key}`)

      logger.info(`Segment deleted: ${id} (${existingSegment.key})`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Get feature flags for a segment
  async getSegmentFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 20
      const skip = (page - 1) * limit

      // Check if segment exists
      const segment = await prisma.segment.findUnique({
        where: { id },
      })

      if (!segment) {
        throw new ApiError(404, "Segment not found")
      }

      // Get feature flags with pagination
      const [featureFlagSegments, total] = await Promise.all([
        prisma.featureFlagSegment.findMany({
          where: {
            segmentId: id,
          },
          include: {
            featureFlag: true,
          },
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.featureFlagSegment.count({
          where: {
            segmentId: id,
          },
        }),
      ])

      res.status(200).json({
        status: "success",
        results: featureFlagSegments.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: featureFlagSegments,
      })
    } catch (error) {
      next(error)
    }
  }
}
