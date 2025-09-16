import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
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

const bulkCreateUsersSchema = z.array(
  z.object({
    email: z.string().email(),
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    role: z.string().default("user"),
  }),
)

const bulkUpdateUsersSchema = z.array(
  z.object({
    id: z.string(),
    email: z.string().email().optional(),
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    role: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
)

const bulkDeleteUsersSchema = z.object({
  ids: z.array(z.string()),
})

const searchUsersSchema = z.object({
  query: z.string().optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
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
        include: {
          profile: true,
        },
        orderBy: {
          createdAt: "desc",
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

      // Create user
      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: validatedData.role,
          tenantId: req.tenant.id,
          profile: {
            create: {},
          },
          preferences: {
            create: {},
          },
        },
        include: {
          profile: true,
          preferences: true,
        },
      })

      // Log user creation
      await prisma.userAuditLog.create({
        data: {
          userId: user.id,
          tenantId: req.tenant.id,
          action: "created",
          performedBy: req.user?.id,
          details: JSON.stringify({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          }),
        },
      })

      // Publish user created event
      await sendMessage("user-events", {
        type: "USER_CREATED",
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          createdAt: user.createdAt,
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
        include: {
          profile: true,
          preferences: true,
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
        include: {
          profile: true,
          preferences: true,
        },
      })

      // Log user update
      await prisma.userAuditLog.create({
        data: {
          userId: updatedUser.id,
          tenantId: req.tenant.id,
          action: "updated",
          performedBy: req.user?.id,
          details: JSON.stringify({
            before: {
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              role: existingUser.role,
              isActive: existingUser.isActive,
            },
            after: {
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              role: updatedUser.role,
              isActive: updatedUser.isActive,
            },
          }),
        },
      })

      // Publish user updated event
      await sendMessage("user-events", {
        type: "USER_UPDATED",
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          tenantId: updatedUser.tenantId,
          isActive: updatedUser.isActive,
          updatedAt: updatedUser.updatedAt,
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

      // Log user deletion before actual deletion
      await prisma.userAuditLog.create({
        data: {
          userId: id,
          tenantId: req.tenant.id,
          action: "deleted",
          performedBy: req.user?.id,
          details: JSON.stringify({
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            role: existingUser.role,
          }),
        },
      })

      // Publish user deleted event
      await sendMessage("user-events", {
        type: "USER_DELETED",
        data: {
          id: existingUser.id,
          email: existingUser.email,
          tenantId: existingUser.tenantId,
          deletedAt: new Date().toISOString(),
        },
      })

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

  // Bulk create users
  async bulkCreateUsers(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkCreateUsersSchema.parse(req.body)

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check for duplicate emails
      const emails = validatedData.map((user) => user.email)
      const existingUsers = await prisma.user.findMany({
        where: {
          email: { in: emails },
          tenantId: req.tenant.id,
        },
        select: {
          email: true,
        },
      })

      if (existingUsers.length > 0) {
        const existingEmails = existingUsers.map((user) => user.email)
        throw new ApiError(400, `Users with these emails already exist: ${existingEmails.join(", ")}`)
      }

      // Create users in a transaction
      const createdUsers = await prisma.$transaction(
        validatedData.map((userData) =>
          prisma.user.create({
            data: {
              ...userData,
              tenantId: req.tenant!.id,
              profile: {
                create: {},
              },
              preferences: {
                create: {},
              },
            },
            include: {
              profile: true,
              preferences: true,
            },
          }),
        ),
      )

      // Log user creations
      await prisma.$transaction(
        createdUsers.map((user) =>
          prisma.userAuditLog.create({
            data: {
              userId: user.id,
              tenantId: req.tenant!.id,
              action: "created",
              performedBy: req.user?.id,
              details: JSON.stringify({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
              }),
            },
          }),
        ),
      )

      // Publish user created events
      for (const user of createdUsers) {
        await sendMessage("user-events", {
          type: "USER_CREATED",
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
            createdAt: user.createdAt,
          },
        })
      }

      logger.info(`Bulk created ${createdUsers.length} users for tenant ${req.tenant.id}`)

      res.status(201).json({
        status: "success",
        results: createdUsers.length,
        data: createdUsers,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk update users
  async bulkUpdateUsers(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkUpdateUsersSchema.parse(req.body)

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Get user IDs
      const userIds = validatedData.map((user) => user.id)

      // Check if users exist and belong to tenant
      const existingUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          tenantId: req.tenant.id,
        },
      })

      if (existingUsers.length !== userIds.length) {
        const foundIds = existingUsers.map((user) => user.id)
        const missingIds = userIds.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some users not found: ${missingIds.join(", ")}`)
      }

      // Check for role escalation
      if (req.user?.role !== "super_admin") {
        const hasRoleEscalation = validatedData.some((userData) => {
          if (!userData.role) return false
          return req.user?.role !== "tenant_admin" || userData.role === "super_admin"
        })

        if (hasRoleEscalation) {
          throw new ApiError(403, "Cannot change to some roles")
        }
      }

      // Update users in a transaction
      const updatedUsers = await prisma.$transaction(
        validatedData.map((userData) => {
          const { id, ...data } = userData
          return prisma.user.update({
            where: { id },
            data,
            include: {
              profile: true,
              preferences: true,
            },
          })
        }),
      )

      // Log user updates
      await prisma.$transaction(
        updatedUsers.map((updatedUser) => {
          const existingUser = existingUsers.find((user) => user.id === updatedUser.id)!
          return prisma.userAuditLog.create({
            data: {
              userId: updatedUser.id,
              tenantId: req.tenant!.id,
              action: "updated",
              performedBy: req.user?.id,
              details: JSON.stringify({
                before: {
                  email: existingUser.email,
                  firstName: existingUser.firstName,
                  lastName: existingUser.lastName,
                  role: existingUser.role,
                  isActive: existingUser.isActive,
                },
                after: {
                  email: updatedUser.email,
                  firstName: updatedUser.firstName,
                  lastName: updatedUser.lastName,
                  role: updatedUser.role,
                  isActive: updatedUser.isActive,
                },
              }),
            },
          })
        }),
      )

      // Publish user updated events
      for (const user of updatedUsers) {
        await sendMessage("user-events", {
          type: "USER_UPDATED",
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
            isActive: user.isActive,
            updatedAt: user.updatedAt,
          },
        })
      }

      logger.info(`Bulk updated ${updatedUsers.length} users for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        results: updatedUsers.length,
        data: updatedUsers,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk delete users
  async bulkDeleteUsers(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkDeleteUsersSchema.parse(req.body)

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if current user is in the list
      if (validatedData.ids.includes(req.user!.id)) {
        throw new ApiError(400, "Cannot delete your own account")
      }

      // Check if users exist and belong to tenant
      const existingUsers = await prisma.user.findMany({
        where: {
          id: { in: validatedData.ids },
          tenantId: req.tenant.id,
        },
      })

      if (existingUsers.length !== validatedData.ids.length) {
        const foundIds = existingUsers.map((user) => user.id)
        const missingIds = validatedData.ids.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some users not found: ${missingIds.join(", ")}`)
      }

      // Log user deletions before actual deletion
      await prisma.$transaction(
        existingUsers.map((user) =>
          prisma.userAuditLog.create({
            data: {
              userId: user.id,
              tenantId: req.tenant!.id,
              action: "deleted",
              performedBy: req.user?.id,
              details: JSON.stringify({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
              }),
            },
          }),
        ),
      )

      // Publish user deleted events
      for (const user of existingUsers) {
        await sendMessage("user-events", {
          type: "USER_DELETED",
          data: {
            id: user.id,
            email: user.email,
            tenantId: user.tenantId,
            deletedAt: new Date().toISOString(),
          },
        })
      }

      // Delete users
      await prisma.user.deleteMany({
        where: {
          id: { in: validatedData.ids },
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Bulk deleted ${existingUsers.length} users for tenant ${req.tenant.id}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Search users
  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate query parameters
      const validatedData = searchUsersSchema.parse(req.query)

      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Build where clause
      const where: any = {
        tenantId: req.tenant.id,
      }

      if (validatedData.query) {
        where.OR = [
          { email: { contains: validatedData.query, mode: "insensitive" } },
          { firstName: { contains: validatedData.query, mode: "insensitive" } },
          { lastName: { contains: validatedData.query, mode: "insensitive" } },
        ]
      }

      if (validatedData.role) {
        where.role = validatedData.role
      }

      if (validatedData.isActive !== undefined) {
        where.isActive = validatedData.isActive
      }

      // Calculate pagination
      const skip = (validatedData.page - 1) * validatedData.limit

      // Get users
      const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          include: {
            profile: true,
          },
          orderBy: {
            [validatedData.sortBy]: validatedData.sortOrder,
          },
          skip,
          take: validatedData.limit,
        }),
        prisma.user.count({ where }),
      ])

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / validatedData.limit)
      const hasNextPage = validatedData.page < totalPages
      const hasPrevPage = validatedData.page > 1

      res.status(200).json({
        status: "success",
        results: users.length,
        pagination: {
          page: validatedData.page,
          limit: validatedData.limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        data: users,
      })
    } catch (error) {
      next(error)
    }
  }
}
