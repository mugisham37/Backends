import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { z } from "zod"

// Validation schemas
const updateProfileSchema = z.object({
  avatarUrl: z.string().url().optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
  language: z.string().max(10).optional().nullable(),
})

export class ProfileController {
  // Get current user's profile
  async getCurrentUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      const profile = await prisma.userProfile.findUnique({
        where: { userId: req.user.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      })

      if (!profile) {
        // Create profile if it doesn't exist
        const newProfile = await prisma.userProfile.create({
          data: {
            userId: req.user.id,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        })

        return res.status(200).json({
          status: "success",
          data: newProfile,
        })
      }

      res.status(200).json({
        status: "success",
        data: profile,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update current user's profile
  async updateCurrentUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      // Validate request body
      const validatedData = updateProfileSchema.parse(req.body)

      // Check if profile exists
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId: req.user.id },
      })

      // Update or create profile
      const profile = existingProfile
        ? await prisma.userProfile.update({
            where: { userId: req.user.id },
            data: validatedData,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          })
        : await prisma.userProfile.create({
            data: {
              userId: req.user.id,
              ...validatedData,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          })

      logger.info(`Profile ${existingProfile ? "updated" : "created"} for user ${req.user.id}`)

      res.status(200).json({
        status: "success",
        data: profile,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get user profile by user ID
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
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

      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      })

      if (!profile) {
        // Create profile if it doesn't exist
        const newProfile = await prisma.userProfile.create({
          data: {
            userId,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        })

        return res.status(200).json({
          status: "success",
          data: newProfile,
        })
      }

      res.status(200).json({
        status: "success",
        data: profile,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update user profile by user ID
  async updateUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Validate request body
      const validatedData = updateProfileSchema.parse(req.body)

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

      // Check if profile exists
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId },
      })

      // Update or create profile
      const profile = existingProfile
        ? await prisma.userProfile.update({
            where: { userId },
            data: validatedData,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          })
        : await prisma.userProfile.create({
            data: {
              userId,
              ...validatedData,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          })

      logger.info(`Profile ${existingProfile ? "updated" : "created"} for user ${userId} by ${req.user?.id}`)

      res.status(200).json({
        status: "success",
        data: profile,
      })
    } catch (error) {
      next(error)
    }
  }
}
