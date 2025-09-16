import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import redisClient from "../utils/redis-client"
import { z } from "zod"

// Validation schemas
const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  isEnabled: z.boolean().default(false),
  type: z.enum(["boolean", "string", "number", "json"]).default("boolean"),
  defaultValue: z.string().default("false"),
  rules: z.any().optional(),
})

const updateFeatureFlagSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  type: z.enum(["boolean", "string", "number", "json"]).optional(),
  defaultValue: z.string().optional(),
  rules: z.any().optional(),
})

const tenantOverrideSchema = z.object({
  isEnabled: z.boolean().optional(),
  value: z.string().optional(),
})

const userOverrideSchema = z.object({
  isEnabled: z.boolean().optional(),
  value: z.string().optional(),
})

const featureFlagSegmentSchema = z.object({
  isEnabled: z.boolean().optional(),
  value: z.string().optional(),
})

export class FeatureFlagController {
  // Get all feature flags
  async getAllFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 20
      const skip = (page - 1) * limit

      // Get feature flags with pagination
      const [featureFlags, total] = await Promise.all([
        prisma.featureFlag.findMany({
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.featureFlag.count(),
      ])

      res.status(200).json({
        status: "success",
        results: featureFlags.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: featureFlags,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get feature flag by ID
  async getFeatureFlagById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
        include: {
          tenantOverrides: true,
          userOverrides: true,
          segments: {
            include: {
              segment: true,
            },
          },
        },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      res.status(200).json({
        status: "success",
        data: featureFlag,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get feature flag by key
  async getFeatureFlagByKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params

      const featureFlag = await prisma.featureFlag.findUnique({
        where: { key },
        include: {
          tenantOverrides: true,
          userOverrides: true,
          segments: {
            include: {
              segment: true,
            },
          },
        },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      res.status(200).json({
        status: "success",
        data: featureFlag,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create feature flag
  async createFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      // Validate request body
      const validatedData = createFeatureFlagSchema.parse(req.body)

      // Check if feature flag with key already exists
      const existingFeatureFlag = await prisma.featureFlag.findUnique({
        where: { key: validatedData.key },
      })

      if (existingFeatureFlag) {
        throw new ApiError(400, "Feature flag with this key already exists")
      }

      // Create feature flag
      const featureFlag = await prisma.featureFlag.create({
        data: {
          ...validatedData,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      })

      // Log feature flag creation
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: featureFlag.id,
          action: "created",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            name: featureFlag.name,
            isEnabled: featureFlag.isEnabled,
            type: featureFlag.type,
            defaultValue: featureFlag.defaultValue,
          },
        },
      })

      // Publish feature flag created event
      await sendMessage("feature-events", {
        type: "FEATURE_FLAG_CREATED",
        data: {
          id: featureFlag.id,
          key: featureFlag.key,
          name: featureFlag.name,
          isEnabled: featureFlag.isEnabled,
          type: featureFlag.type,
          defaultValue: featureFlag.defaultValue,
          createdAt: featureFlag.createdAt,
          createdBy: featureFlag.createdBy,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flags:all`)

      logger.info(`Feature flag created: ${featureFlag.id} (${featureFlag.key})`)

      res.status(201).json({
        status: "success",
        data: featureFlag,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update feature flag
  async updateFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Validate request body
      const validatedData = updateFeatureFlagSchema.parse(req.body)

      // Check if feature flag exists
      const existingFeatureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!existingFeatureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Update feature flag
      const updatedFeatureFlag = await prisma.featureFlag.update({
        where: { id },
        data: {
          ...validatedData,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
      })

      // Log feature flag update
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: updatedFeatureFlag.id,
          action: "updated",
          performedBy: req.user.id,
          details: {
            before: {
              name: existingFeatureFlag.name,
              description: existingFeatureFlag.description,
              isEnabled: existingFeatureFlag.isEnabled,
              type: existingFeatureFlag.type,
              defaultValue: existingFeatureFlag.defaultValue,
              rules: existingFeatureFlag.rules,
            },
            after: {
              name: updatedFeatureFlag.name,
              description: updatedFeatureFlag.description,
              isEnabled: updatedFeatureFlag.isEnabled,
              type: updatedFeatureFlag.type,
              defaultValue: updatedFeatureFlag.defaultValue,
              rules: updatedFeatureFlag.rules,
            },
          },
        },
      })

      // Publish feature flag updated event
      await sendMessage("feature-events", {
        type: "FEATURE_FLAG_UPDATED",
        data: {
          id: updatedFeatureFlag.id,
          key: updatedFeatureFlag.key,
          name: updatedFeatureFlag.name,
          isEnabled: updatedFeatureFlag.isEnabled,
          type: updatedFeatureFlag.type,
          defaultValue: updatedFeatureFlag.defaultValue,
          updatedAt: updatedFeatureFlag.updatedAt,
          updatedBy: updatedFeatureFlag.updatedBy,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flags:all`)
      await redisClient.del(`feature_flag:${id}`)
      await redisClient.del(`feature_flag:${existingFeatureFlag.key}`)

      logger.info(`Feature flag updated: ${updatedFeatureFlag.id} (${updatedFeatureFlag.key})`)

      res.status(200).json({
        status: "success",
        data: updatedFeatureFlag,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete feature flag
  async deleteFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Check if feature flag exists
      const existingFeatureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!existingFeatureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Log feature flag deletion before actual deletion
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          action: "deleted",
          performedBy: req.user.id,
          details: {
            key: existingFeatureFlag.key,
            name: existingFeatureFlag.name,
          },
        },
      })

      // Publish feature flag deleted event
      await sendMessage("feature-events", {
        type: "FEATURE_FLAG_DELETED",
        data: {
          id: existingFeatureFlag.id,
          key: existingFeatureFlag.key,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.id,
        },
      })

      // Delete feature flag (cascade will delete all related data)
      await prisma.featureFlag.delete({
        where: { id },
      })

      // Clear cache
      await redisClient.del(`feature_flags:all`)
      await redisClient.del(`feature_flag:${id}`)
      await redisClient.del(`feature_flag:${existingFeatureFlag.key}`)

      logger.info(`Feature flag deleted: ${id} (${existingFeatureFlag.key})`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Toggle feature flag (enable/disable)
  async toggleFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Check if feature flag exists
      const existingFeatureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!existingFeatureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Toggle isEnabled
      const updatedFeatureFlag = await prisma.featureFlag.update({
        where: { id },
        data: {
          isEnabled: !existingFeatureFlag.isEnabled,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
      })

      // Log feature flag toggle
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: updatedFeatureFlag.id,
          action: updatedFeatureFlag.isEnabled ? "enabled" : "disabled",
          performedBy: req.user.id,
          details: {
            key: updatedFeatureFlag.key,
            name: updatedFeatureFlag.name,
          },
        },
      })

      // Publish feature flag updated event
      await sendMessage("feature-events", {
        type: "FEATURE_FLAG_UPDATED",
        data: {
          id: updatedFeatureFlag.id,
          key: updatedFeatureFlag.key,
          isEnabled: updatedFeatureFlag.isEnabled,
          updatedAt: updatedFeatureFlag.updatedAt,
          updatedBy: updatedFeatureFlag.updatedBy,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flags:all`)
      await redisClient.del(`feature_flag:${id}`)
      await redisClient.del(`feature_flag:${existingFeatureFlag.key}`)

      logger.info(
        `Feature flag ${updatedFeatureFlag.isEnabled ? "enabled" : "disabled"}: ${updatedFeatureFlag.id} (${updatedFeatureFlag.key})`,
      )

      res.status(200).json({
        status: "success",
        data: updatedFeatureFlag,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get tenant overrides for a feature flag
  async getTenantOverrides(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 20
      const skip = (page - 1) * limit

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Get tenant overrides with pagination
      const [tenantOverrides, total] = await Promise.all([
        prisma.tenantFeatureOverride.findMany({
          where: {
            featureFlagId: id,
          },
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.tenantFeatureOverride.count({
          where: {
            featureFlagId: id,
          },
        }),
      ])

      res.status(200).json({
        status: "success",
        results: tenantOverrides.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: tenantOverrides,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create or update tenant override
  async upsertTenantOverride(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, tenantId } = req.params

      // Validate request body
      const validatedData = tenantOverrideSchema.parse(req.body)

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if tenant override exists
      const existingOverride = await prisma.tenantFeatureOverride.findUnique({
        where: {
          tenantId_featureFlagId: {
            tenantId,
            featureFlagId: id,
          },
        },
      })

      // Create or update tenant override
      const tenantOverride = await prisma.tenantFeatureOverride.upsert({
        where: {
          tenantId_featureFlagId: {
            tenantId,
            featureFlagId: id,
          },
        },
        update: {
          ...validatedData,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          featureFlagId: id,
          isEnabled: validatedData.isEnabled ?? featureFlag.isEnabled,
          value: validatedData.value,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      })

      // Log tenant override creation/update
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          tenantId,
          action: existingOverride ? "tenant_override_updated" : "tenant_override_created",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            tenantId,
            isEnabled: tenantOverride.isEnabled,
            value: tenantOverride.value,
          },
        },
      })

      // Publish tenant override event
      await sendMessage("feature-events", {
        type: existingOverride ? "TENANT_OVERRIDE_UPDATED" : "TENANT_OVERRIDE_CREATED",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          tenantId,
          isEnabled: tenantOverride.isEnabled,
          value: tenantOverride.value,
          updatedAt: tenantOverride.updatedAt,
          updatedBy: tenantOverride.updatedBy,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}:tenant:${tenantId}`)
      await redisClient.del(`feature_flag:${featureFlag.key}:tenant:${tenantId}`)

      logger.info(
        `Tenant override ${existingOverride ? "updated" : "created"}: ${tenantOverride.id} for feature flag ${featureFlag.key} and tenant ${tenantId}`,
      )

      res.status(existingOverride ? 200 : 201).json({
        status: "success",
        data: tenantOverride,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete tenant override
  async deleteTenantOverride(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, tenantId } = req.params

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if tenant override exists
      const existingOverride = await prisma.tenantFeatureOverride.findUnique({
        where: {
          tenantId_featureFlagId: {
            tenantId,
            featureFlagId: id,
          },
        },
      })

      if (!existingOverride) {
        throw new ApiError(404, "Tenant override not found")
      }

      // Log tenant override deletion before actual deletion
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          tenantId,
          action: "tenant_override_deleted",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            tenantId,
          },
        },
      })

      // Publish tenant override deleted event
      await sendMessage("feature-events", {
        type: "TENANT_OVERRIDE_DELETED",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          tenantId,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.id,
        },
      })

      // Delete tenant override
      await prisma.tenantFeatureOverride.delete({
        where: {
          tenantId_featureFlagId: {
            tenantId,
            featureFlagId: id,
          },
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}:tenant:${tenantId}`)
      await redisClient.del(`feature_flag:${featureFlag.key}:tenant:${tenantId}`)

      logger.info(`Tenant override deleted for feature flag ${featureFlag.key} and tenant ${tenantId}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Get user overrides for a feature flag
  async getUserOverrides(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 20
      const skip = (page - 1) * limit

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Get user overrides with pagination
      const [userOverrides, total] = await Promise.all([
        prisma.userFeatureOverride.findMany({
          where: {
            featureFlagId: id,
          },
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.userFeatureOverride.count({
          where: {
            featureFlagId: id,
          },
        }),
      ])

      res.status(200).json({
        status: "success",
        results: userOverrides.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: userOverrides,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create or update user override
  async upsertUserOverride(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, userId } = req.params

      // Validate request body
      const validatedData = userOverrideSchema.parse(req.body)

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if user override exists
      const existingOverride = await prisma.userFeatureOverride.findUnique({
        where: {
          userId_featureFlagId: {
            userId,
            featureFlagId: id,
          },
        },
      })

      // Create or update user override
      const userOverride = await prisma.userFeatureOverride.upsert({
        where: {
          userId_featureFlagId: {
            userId,
            featureFlagId: id,
          },
        },
        update: {
          ...validatedData,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
        create: {
          userId,
          featureFlagId: id,
          isEnabled: validatedData.isEnabled ?? featureFlag.isEnabled,
          value: validatedData.value,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      })

      // Log user override creation/update
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          userId,
          action: existingOverride ? "user_override_updated" : "user_override_created",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            userId,
            isEnabled: userOverride.isEnabled,
            value: userOverride.value,
          },
        },
      })

      // Publish user override event
      await sendMessage("feature-events", {
        type: existingOverride ? "USER_OVERRIDE_UPDATED" : "USER_OVERRIDE_CREATED",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          userId,
          isEnabled: userOverride.isEnabled,
          value: userOverride.value,
          updatedAt: userOverride.updatedAt,
          updatedBy: userOverride.updatedBy,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}:user:${userId}`)
      await redisClient.del(`feature_flag:${featureFlag.key}:user:${userId}`)

      logger.info(
        `User override ${existingOverride ? "updated" : "created"}: ${userOverride.id} for feature flag ${featureFlag.key} and user ${userId}`,
      )

      res.status(existingOverride ? 200 : 201).json({
        status: "success",
        data: userOverride,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete user override
  async deleteUserOverride(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, userId } = req.params

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if user override exists
      const existingOverride = await prisma.userFeatureOverride.findUnique({
        where: {
          userId_featureFlagId: {
            userId,
            featureFlagId: id,
          },
        },
      })

      if (!existingOverride) {
        throw new ApiError(404, "User override not found")
      }

      // Log user override deletion before actual deletion
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          userId,
          action: "user_override_deleted",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            userId,
          },
        },
      })

      // Publish user override deleted event
      await sendMessage("feature-events", {
        type: "USER_OVERRIDE_DELETED",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          userId,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.id,
        },
      })

      // Delete user override
      await prisma.userFeatureOverride.delete({
        where: {
          userId_featureFlagId: {
            userId,
            featureFlagId: id,
          },
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}:user:${userId}`)
      await redisClient.del(`feature_flag:${featureFlag.key}:user:${userId}`)

      logger.info(`User override deleted for feature flag ${featureFlag.key} and user ${userId}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Get segments for a feature flag
  async getFeatureFlagSegments(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Get segments for feature flag
      const segments = await prisma.featureFlagSegment.findMany({
        where: {
          featureFlagId: id,
        },
        include: {
          segment: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: segments.length,
        data: segments,
      })
    } catch (error) {
      next(error)
    }
  }

  // Add segment to feature flag
  async addSegmentToFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, segmentId } = req.params

      // Validate request body
      const validatedData = featureFlagSegmentSchema.parse(req.body)

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if segment exists
      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
      })

      if (!segment) {
        throw new ApiError(404, "Segment not found")
      }

      // Check if segment is already added to feature flag
      const existingSegment = await prisma.featureFlagSegment.findUnique({
        where: {
          featureFlagId_segmentId: {
            featureFlagId: id,
            segmentId,
          },
        },
      })

      if (existingSegment) {
        throw new ApiError(400, "Segment is already added to feature flag")
      }

      // Add segment to feature flag
      const featureFlagSegment = await prisma.featureFlagSegment.create({
        data: {
          featureFlagId: id,
          segmentId,
          isEnabled: validatedData.isEnabled ?? featureFlag.isEnabled,
          value: validatedData.value,
        },
        include: {
          segment: true,
        },
      })

      // Log segment addition
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          action: "segment_added",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            segmentId,
            segmentKey: segment.key,
            isEnabled: featureFlagSegment.isEnabled,
            value: featureFlagSegment.value,
          },
        },
      })

      // Publish segment added event
      await sendMessage("feature-events", {
        type: "SEGMENT_ADDED_TO_FEATURE_FLAG",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          segmentId,
          segmentKey: segment.key,
          isEnabled: featureFlagSegment.isEnabled,
          value: featureFlagSegment.value,
          createdAt: featureFlagSegment.createdAt,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}`)
      await redisClient.del(`feature_flag:${featureFlag.key}`)

      logger.info(`Segment added to feature flag: ${segment.key} to ${featureFlag.key}`)

      res.status(201).json({
        status: "success",
        data: featureFlagSegment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update segment settings for feature flag
  async updateFeatureFlagSegment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, segmentId } = req.params

      // Validate request body
      const validatedData = featureFlagSegmentSchema.parse(req.body)

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if segment exists
      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
      })

      if (!segment) {
        throw new ApiError(404, "Segment not found")
      }

      // Check if segment is added to feature flag
      const existingSegment = await prisma.featureFlagSegment.findUnique({
        where: {
          featureFlagId_segmentId: {
            featureFlagId: id,
            segmentId,
          },
        },
      })

      if (!existingSegment) {
        throw new ApiError(404, "Segment is not added to feature flag")
      }

      // Update segment settings
      const updatedFeatureFlagSegment = await prisma.featureFlagSegment.update({
        where: {
          featureFlagId_segmentId: {
            featureFlagId: id,
            segmentId,
          },
        },
        data: {
          isEnabled: validatedData.isEnabled,
          value: validatedData.value,
          updatedAt: new Date(),
        },
        include: {
          segment: true,
        },
      })

      // Log segment update
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          action: "segment_updated",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            segmentId,
            segmentKey: segment.key,
            before: {
              isEnabled: existingSegment.isEnabled,
              value: existingSegment.value,
            },
            after: {
              isEnabled: updatedFeatureFlagSegment.isEnabled,
              value: updatedFeatureFlagSegment.value,
            },
          },
        },
      })

      // Publish segment updated event
      await sendMessage("feature-events", {
        type: "SEGMENT_UPDATED_FOR_FEATURE_FLAG",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          segmentId,
          segmentKey: segment.key,
          isEnabled: updatedFeatureFlagSegment.isEnabled,
          value: updatedFeatureFlagSegment.value,
          updatedAt: updatedFeatureFlagSegment.updatedAt,
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}`)
      await redisClient.del(`feature_flag:${featureFlag.key}`)

      logger.info(`Segment updated for feature flag: ${segment.key} for ${featureFlag.key}`)

      res.status(200).json({
        status: "success",
        data: updatedFeatureFlagSegment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Remove segment from feature flag
  async removeSegmentFromFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id, segmentId } = req.params

      // Check if feature flag exists
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { id },
      })

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Check if segment exists
      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
      })

      if (!segment) {
        throw new ApiError(404, "Segment not found")
      }

      // Check if segment is added to feature flag
      const existingSegment = await prisma.featureFlagSegment.findUnique({
        where: {
          featureFlagId_segmentId: {
            featureFlagId: id,
            segmentId,
          },
        },
      })

      if (!existingSegment) {
        throw new ApiError(404, "Segment is not added to feature flag")
      }

      // Log segment removal before actual deletion
      await prisma.featureFlagAuditLog.create({
        data: {
          featureFlagId: id,
          action: "segment_removed",
          performedBy: req.user.id,
          details: {
            key: featureFlag.key,
            segmentId,
            segmentKey: segment.key,
          },
        },
      })

      // Publish segment removed event
      await sendMessage("feature-events", {
        type: "SEGMENT_REMOVED_FROM_FEATURE_FLAG",
        data: {
          featureFlagId: id,
          featureFlagKey: featureFlag.key,
          segmentId,
          segmentKey: segment.key,
          removedAt: new Date().toISOString(),
          removedBy: req.user.id,
        },
      })

      // Remove segment from feature flag
      await prisma.featureFlagSegment.delete({
        where: {
          featureFlagId_segmentId: {
            featureFlagId: id,
            segmentId,
          },
        },
      })

      // Clear cache
      await redisClient.del(`feature_flag:${id}`)
      await redisClient.del(`feature_flag:${featureFlag.key}`)

      logger.info(`Segment removed from feature flag: ${segment.key} from ${featureFlag.key}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
