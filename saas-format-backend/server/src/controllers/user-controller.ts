import type { Request, Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { z } from "zod"

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: z.string().default("user"),
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
})

export class UserController {
  // Get all users for current tenant
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const users = await prisma.user.findMany({
        where: {
          tenantId: req.tenant.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      res.status(200).json({
        status: "success",
        results: users.length,
        data: users,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create a new user
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = createUserSchema.parse(req.body)

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          tenantId: req.tenant.id,
        },
      })

      if (existingUser) {
        throw new ApiError(400, "User with this email already exists")
      }

      // Check tenant user limits
      const tenantSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: req.tenant.id },
      })

      const userCount = await prisma.user.count({
        where: { tenantId: req.tenant.id },
      })

      if (tenantSettings && userCount >= tenantSettings.maxUsers) {
        throw new ApiError(403, "Maximum user limit reached for this tenant")
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: validatedData.role,
          tenantId: req.tenant.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      })

      logger.info(`User created: ${user.id} (${user.email}) for tenant ${req.tenant.id}`)

      res.status(201).json({
        status: "success",
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get user by ID
  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if user exists and belongs to tenant
      const user = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!user) {
        throw new ApiError(404, "User not found")
      }

      // Check if requesting user has permission
      if (req.user?.id !== id && req.user?.role !== "tenant_admin" && req.user?.role !== "super_admin") {
        throw new ApiError(403, "Insufficient permissions")
      }

      res.status(200).json({
        status: "success",
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update user
  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updateUserSchema.parse(req.body)

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if user exists and belongs to tenant
      const existingUser = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
      })

      if (!existingUser) {
        throw new ApiError(404, "User not found")
      }

      // Check if requesting user has permission
      if (req.user?.id !== id && req.user?.role !== "tenant_admin" && req.user?.role !== "super_admin") {
        throw new ApiError(403, "Insufficient permissions")
      }

      // Prevent role escalation
      if (
        validatedData.role &&
        req.user?.role !== "super_admin" &&
        (req.user?.role !== "tenant_admin" || validatedData.role === "super_admin")
      ) {
        throw new ApiError(403, "Cannot change to this role")
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: validatedData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      logger.info(`User updated: ${updatedUser.id} (${updatedUser.email})`)

      res.status(200).json({
        status: "success",
        data: updatedUser,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete user
  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if user exists and belongs to tenant
      const existingUser = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
      })

      if (!existingUser) {
        throw new ApiError(404, "User not found")
      }

      // Prevent deleting yourself
      if (req.user?.id === id) {
        throw new ApiError(400, "Cannot delete your own account")
      }

      // Delete user
      await prisma.user.delete({
        where: { id },
      })

      logger.info(`User deleted: ${id} (${existingUser.email})`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
