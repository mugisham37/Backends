import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { z } from "zod"

// Validation schemas
const updatePreferenceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("light"),
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  weeklyDigest: z.boolean().default(true),
})

export class PreferenceController {
  // Get current user's preferences
  async getCurrentUserPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      const preferences = await prisma.userPreference.findUnique({
        where: { userId: req.user.id },
      })

      if (!preferences) {
        // Create preferences if they don't exist
        const newPreferences = await prisma.userPreference.create({
          data: {
            userId: req.user.id,
          },
        })

        return res.status(200).json({
          status: "success",
          data: newPreferences,
        })
      }

      res.status(200).json({
        status: "success",
        data: preferences,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update current user's preferences
  async updateCurrentUserPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      // Validate request body
      const validatedData = updatePreferenceSchema.parse(req.body)

      // Check if preferences exist
      const existingPreferences = await prisma.userPreference.findUnique({
        where: { userId: req.user.id },
      })

      // Update or create preferences
      const preferences = existingPreferences
        ? await prisma.userPreference.update({
            where: { userId: req.user.id },
            data: validatedData,
          })
        : await prisma.userPreference.create({
            data: {
              userId: req.user.id,
              ...validatedData,
            },
          })

      logger.info(`Preferences ${existingPreferences ? "updated" : "created"} for user ${req.user.id}`)

      res.status(200).json({
        status: "success",
        data: preferences,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get user preferences by user ID
  async getUserPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if user exists and belongs to tenant
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          tenantId: req.tenant.id,
        },
        select: {
          id: true,
        },
      })

      if (!user) {
        throw new ApiError(404, "User not found")
      }

      // Check if requesting user has permission
      if (req.user?.id !== userId && req.user?.role !== "tenant_admin" && req.user?.role !== "super_admin") {
        throw new ApiError(403, "Insufficient permissions")
      }

      const preferences = await prisma.userPreference.findUnique({
        where: { userId },
      })

      if (!preferences) {
        // Create preferences if they don't exist
        const newPreferences = await prisma.userPreference.create({
          data: {
            userId,
          },
        })

        return res.status(200).json({
          status: "success",
          data: newPreferences,
        })
      }

      res.status(200).json({
        status: "success",
        data: preferences,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update user preferences by user ID
  async updateUserPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Validate request body
      const validatedData = updatePreferenceSchema.parse(req.body)

      // Check if user exists and belongs to tenant
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          tenantId: req.tenant.id,
        },
        select: {
          id: true,
        },
      })

      if (!user) {
        throw new ApiError(404, "User not found")
      }

      // Check if requesting user has permission
      if (req.user?.id !== userId && req.user?.role !== "tenant_admin" && req.user?.role !== "super_admin") {
        throw new ApiError(403, "Insufficient permissions")
      }

      // Check if preferences exist
      const existingPreferences = await prisma.userPreference.findUnique({
        where: { userId },
      })

      // Update or create preferences
      const preferences = existingPreferences
        ? await prisma.userPreference.update({
            where: { userId },
            data: validatedData,
          })
        : await prisma.userPreference.create({
            data: {
              userId,
              ...validatedData,
            },
          })

      logger.info(`Preferences ${existingPreferences ? "updated" : "created"} for user ${userId} by ${req.user?.id}`)

      res.status(200).json({
        status: "success",
        data: preferences,
      })
    } catch (error) {
      next(error)
    }
  }
}
