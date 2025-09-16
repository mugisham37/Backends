import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import redisClient from "../utils/redis-client"
import { z } from "zod"

// Validation schemas
const evaluateRequestSchema = z.object({
  userId: z.string().optional(),
  tenantId: z.string(),
  attributes: z.record(z.any()).optional(),
})

export class EvaluationController {
  // Evaluate all feature flags for a user
  async evaluateAllFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = evaluateRequestSchema.parse(req.body)

      // Get all feature flags
      const featureFlags = await this.getAllFeatureFlags()

      // Evaluate each feature flag
      const evaluations = await Promise.all(
        featureFlags.map(async (featureFlag) => {
          const evaluation = await this.evaluateFlag(
            featureFlag,
            validatedData.userId,
            validatedData.tenantId,
            validatedData.attributes,
          )
          return {
            key: featureFlag.key,
            enabled: evaluation.enabled,
            value: evaluation.value,
          }
        }),
      )

      // Convert to object with keys
      const result = evaluations.reduce((acc, evaluation) => {
        acc[evaluation.key] = {
          enabled: evaluation.enabled,
          value: evaluation.value,
        }
        return acc
      }, {} as Record<string, { enabled: boolean; value: any }>)

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  // Evaluate a specific feature flag for a user
  async evaluateFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params

      // Validate request body
      const validatedData = evaluateRequestSchema.parse(req.body)

      // Get feature flag
      const featureFlag = await this.getFeatureFlagByKey(key)

      if (!featureFlag) {
        throw new ApiError(404, "Feature flag not found")
      }

      // Evaluate feature flag
      const evaluation = await this.evaluateFlag(
        featureFlag,
        validatedData.userId,
        validatedData.tenantId,
        validatedData.attributes,
      )

      res.status(200).json({
        status: "success",
        data: {
          key: featureFlag.key,
          enabled: evaluation.enabled,
          value: evaluation.value,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Helper method to get all feature flags (with caching)
  private async getAllFeatureFlags() {
    // Try to get from cache
    const cachedFeatureFlags = await redisClient.get("feature_flags:all")
    if (cachedFeatureFlags) {
      return JSON.parse(cachedFeatureFlags)
    }

    // Get from database
    const featureFlags = await prisma.featureFlag.findMany()

    // Cache for 5 minutes
    await redisClient.set("feature_flags:all", JSON.stringify(featureFlags), "EX", 300)

    return featureFlags
  }

  // Helper method to get feature flag by key (with caching)
  private async getFeatureFlagByKey(key: string) {
    // Try to get from cache
    const cachedFeatureFlag = await redisClient.get(`feature_flag:${key}`)
    if (cachedFeatureFlag) {
      return JSON.parse(cachedFeatureFlag)
    }

    // Get from database
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

    if (featureFlag) {
      // Cache for 5 minutes
      await redisClient.set(`feature_flag:${key}`, JSON.stringify(featureFlag), "EX", 300)
    }

    return featureFlag
  }

  // Helper method to evaluate a feature flag
  private async evaluateFlag(
    featureFlag: any,
    userId?: string,
    tenantId?: string,
    attributes?: Record<string, any>,
  ) {
    // Default result based on feature flag settings
    let enabled = featureFlag.isEnabled
    let value = this.parseValue(featureFlag.defaultValue, featureFlag.type)

    // Check user override if userId provided
    if (userId) {
      const userOverride = featureFlag.userOverrides?.find((override: any) => override.userId === userId)
      if (userOverride) {
        enabled = userOverride.isEnabled
        if (userOverride.value) {
          value = this.parseValue(userOverride.value, featureFlag.type)
        }
        return { enabled, value }
      }
    }

    // Check tenant override if tenantId provided
    if (tenantId) {
      const tenantOverride = featureFlag.tenantOverrides?.find((override: any) => override.tenantId === tenantId)
      if (tenantOverride) {
        enabled = tenantOverride.isEnabled
        if (tenantOverride.value) {
          value = this.parseValue(tenantOverride.value, featureFlag.type)
        }
        return { enabled, value }
      }
    }

    // Check segment rules if attributes provided
    if (attributes && featureFlag.segments?.length > 0) {
      for (const featureFlagSegment of featureFlag.segments) {
        const segment = featureFlagSegment.segment
        if (this.isUserInSegment(segment, attributes)) {
          enabled = featureFlagSegment.isEnabled
          if (featureFlagSegment.value) {
            value = this.parseValue(featureFlagSegment.value, featureFlag.type)
          }
          return { enabled, value }
        }
      }
    }

    // Check targeting rules if defined
    if (featureFlag.rules && attributes) {
      const rules = featureFlag.rules as any
      if (rules.targeting && this.evaluateTargetingRules(rules.targeting, attributes)) {
        enabled = rules.enabled ?? enabled
        if (rules.value) {
          value = this.parseValue(rules.value, featureFlag.type)
        }
        return { enabled, value }
      }
    }

    return { enabled, value }
  }

  // Helper method to parse value based on type
  private parseValue(valueStr: string, type: string) {
    try {
      switch (type) {
        case "boolean":
          return valueStr === "true"
        case "number":
          return Number(valueStr)
        case "json":
          return JSON.parse(valueStr)
        case "string":
        default:
          return valueStr
      }
    } catch (error) {
      logger.error(`Error parsing value: ${error instanceof Error ? error.message : String(error)}`)
      return valueStr
    }
  }

  // Helper method to check if user is in segment
  private isUserInSegment(segment: any, attributes: Record<string, any>) {
    if (!segment.rules) {
      return false
    }

    const rules = segment.rules as any

    // Simple rule evaluation - in a real system, this would be more sophisticated
    if (rules.conditions && Array.isArray(rules.conditions)) {
      return rules.conditions.every((condition: any) => {
        const attributeValue = attributes[condition.attribute]
