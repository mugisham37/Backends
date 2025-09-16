import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import redisClient from "../utils/redis-client"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  domain: z.string().optional(),
  plan: z.string().default("free"),
})

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  domain: z.string().optional(),
  plan: z.string().optional(),
  isActive: z.boolean().optional(),
})

const updateTenantSettingsSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  allowSignup: z.boolean().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxProjects: z.number().int().positive().optional(),
  maxStorage: z.number().int().positive().optional(),
})

const createTenantDatabaseSchema = z.object({
  connectionString: z.string(),
  type: z.string().default("postgres"),
})

const updateTenantDatabaseSchema = z.object({
  connectionString: z.string().optional(),
  isActive: z.boolean().optional(),
})

export class TenantController {
  // Create a new tenant
  async createTenant(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = createTenantSchema.parse(req.body)

      // Check if tenant with slug already exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug: validatedData.slug },
      })

      if (existingTenant) {
        throw new ApiError(400, "Tenant with this slug already exists")
      }

      // Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: validatedData.name,
          slug: validatedData.slug,
          domain: validatedData.domain,
          plan: validatedData.plan,
          settings: {
            create: {
              // Default settings based on plan
              allowSignup: true,
              maxUsers: validatedData.plan === "free" ? 5 : validatedData.plan === "pro" ? 20 : 100,
              maxProjects: validatedData.plan === "free" ? 10 : validatedData.plan === "pro" ? 50 : 500,
              maxStorage: validatedData.plan === "free" ? 1024 : validatedData.plan === "pro" ? 5120 : 51200, // in MB
            },
          },
        },
        include: {
          settings: true,
        },
      })

      // Log tenant creation
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: tenant.id,
          action: "created",
          performedBy: req.user?.id,
          details: JSON.stringify({
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
          }),
        },
      })

      // Publish tenant created event
      await sendMessage("tenant-events", {
        type: "TENANT_CREATED",
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          plan: tenant.plan,
          settings: tenant.settings,
          createdAt: tenant.createdAt,
        },
      })

      // Cache tenant data
      await redisClient.set(
        `tenant:${tenant.id}`,
        JSON.stringify({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          isActive: tenant.isActive,
        }),
        "EX",
        300,
      ) // Cache for 5 minutes

      await redisClient.set(
        `tenant:${tenant.slug}`,
        JSON.stringify({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          isActive: tenant.isActive,
        }),
        "EX",
        300,
      ) // Cache for 5 minutes

      if (tenant.domain) {
        await redisClient.set(
          `tenant:${tenant.domain}`,
          JSON.stringify({
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            isActive: tenant.isActive,
          }),
          "EX",
          300,
        ) // Cache for 5 minutes
      }

      logger.info(`Tenant created: ${tenant.id} (${tenant.name})`)

      res.status(201).json({
        status: "success",
        data: tenant,
      })
    } catch (error) {
      next(error)
    }
  }

  // Lookup tenant by identifier (id, slug, or domain)
  async lookupTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier } = req.params

      if (!identifier) {
        throw new ApiError(400, "Tenant identifier is required")
      }

      // Try to get from cache first
      const cachedTenant = await redisClient.get(`tenant:${identifier}`)

      if (cachedTenant) {
        return res.status(200).json({
          status: "success",
          data: JSON.parse(cachedTenant),
        })
      }

      // Find tenant by id, slug, or domain
      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ id: identifier }, { slug: identifier }, { domain: identifier }],
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      })

      if (!tenant) {
        throw new ApiError(404, "Tenant not found or inactive")
      }

      // Cache the result
      await redisClient.set(`tenant:${identifier}`, JSON.stringify(tenant), "EX", 300) // Cache for 5 minutes

      res.status(200).json({
        status: "success",
        data: tenant,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get all tenants (admin only)
  async getAllTenants(req: Request, res: Response, next: NextFunction) {
    try {
      const tenants = await prisma.tenant.findMany({
        include: {
          settings: true,
        },
      })

      res.status(200).json({
        status: "success",
        results: tenants.length,
        data: tenants,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get tenant by ID
  async getTenantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          settings: true,
        },
      })

      if (!tenant) {
        throw new ApiError(404, "Tenant not found")
      }

      res.status(200).json({
        status: "success",
        data: tenant,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update tenant
  async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updateTenantSchema.parse(req.body)

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Update tenant
      const updatedTenant = await prisma.tenant.update({
        where: { id },
        data: validatedData,
        include: {
          settings: true,
        },
      })

      // Log tenant update
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: updatedTenant.id,
          action: "updated",
          performedBy: req.user?.id,
          details: JSON.stringify({
            before: {
              name: existingTenant.name,
              domain: existingTenant.domain,
              plan: existingTenant.plan,
              isActive: existingTenant.isActive,
            },
            after: {
              name: updatedTenant.name,
              domain: updatedTenant.domain,
              plan: updatedTenant.plan,
              isActive: updatedTenant.isActive,
            },
          }),
        },
      })

      // Publish tenant updated event
      await sendMessage("tenant-events", {
        type: "TENANT_UPDATED",
        data: {
          id: updatedTenant.id,
          name: updatedTenant.name,
          slug: updatedTenant.slug,
          domain: updatedTenant.domain,
          plan: updatedTenant.plan,
          isActive: updatedTenant.isActive,
          updatedAt: updatedTenant.updatedAt,
        },
      })

      // Update cache
      await redisClient.del(`tenant:${id}`)
      await redisClient.del(`tenant:${updatedTenant.slug}`)
      if (existingTenant.domain) {
        await redisClient.del(`tenant:${existingTenant.domain}`)
      }
      if (updatedTenant.domain) {
        await redisClient.del(`tenant:${updatedTenant.domain}`)
      }

      logger.info(`Tenant updated: ${updatedTenant.id} (${updatedTenant.name})`)

      res.status(200).json({
        status: "success",
        data: updatedTenant,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete tenant
  async deleteTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Log tenant deletion before actual deletion
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: id,
          action: "deleted",
          performedBy: req.user?.id,
          details: JSON.stringify({
            name: existingTenant.name,
            slug: existingTenant.slug,
            domain: existingTenant.domain,
          }),
        },
      })

      // Publish tenant deleted event
      await sendMessage("tenant-events", {
        type: "TENANT_DELETED",
        data: {
          id: existingTenant.id,
          name: existingTenant.name,
          slug: existingTenant.slug,
          domain: existingTenant.domain,
          deletedAt: new Date().toISOString(),
        },
      })

      // Delete tenant (cascade will delete all related data)
      await prisma.tenant.delete({
        where: { id },
      })

      // Clear cache
      await redisClient.del(`tenant:${id}`)
      await redisClient.del(`tenant:${existingTenant.slug}`)
      if (existingTenant.domain) {
        await redisClient.del(`tenant:${existingTenant.domain}`)
      }

      logger.info(`Tenant deleted: ${id} (${existingTenant.name})`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Get tenant settings
  async getTenantSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: id },
      })

      if (!settings) {
        throw new ApiError(404, "Tenant settings not found")
      }

      res.status(200).json({
        status: "success",
        data: settings,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update tenant settings
  async updateTenantSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updateTenantSettingsSchema.parse(req.body)

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Get existing settings for audit log
      const existingSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: id },
      })

      // Update or create settings
      const settings = await prisma.tenantSettings.upsert({
        where: { tenantId: id },
        update: validatedData,
        create: {
          tenantId: id,
          ...validatedData,
        },
      })

      // Log settings update
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: id,
          action: "settings_updated",
          performedBy: req.user?.id,
          details: JSON.stringify({
            before: existingSettings,
            after: settings,
          }),
        },
      })

      // Publish tenant settings updated event
      await sendMessage("tenant-events", {
        type: "TENANT_SETTINGS_UPDATED",
        data: {
          tenantId: id,
          settings,
          updatedAt: new Date().toISOString(),
        },
      })

      logger.info(`Tenant settings updated: ${id}`)

      res.status(200).json({
        status: "success",
        data: settings,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create tenant database (for database-per-tenant approach)
  async createTenantDatabase(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = createTenantDatabaseSchema.parse(req.body)

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Create tenant database
      const database = await prisma.tenantDatabase.create({
        data: {
          tenantId: id,
          connectionString: validatedData.connectionString,
          type: validatedData.type,
        },
      })

      // Log database creation
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: id,
          action: "database_created",
          performedBy: req.user?.id,
          details: JSON.stringify({
            databaseId: database.id,
            type: database.type,
          }),
        },
      })

      // Publish tenant database created event
      await sendMessage("tenant-events", {
        type: "TENANT_DATABASE_CREATED",
        data: {
          tenantId: id,
          databaseId: database.id,
          type: database.type,
          createdAt: database.createdAt,
        },
      })

      logger.info(`Tenant database created: ${database.id} for tenant ${id}`)

      // Don't include connection string in response for security
      const responseData = {
        id: database.id,
        tenantId: database.tenantId,
        type: database.type,
        isActive: database.isActive,
        createdAt: database.createdAt,
        updatedAt: database.updatedAt,
      }

      res.status(201).json({
        status: "success",
        data: responseData,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get tenant databases
  async getTenantDatabases(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Get tenant databases
      const databases = await prisma.tenantDatabase.findMany({
        where: { tenantId: id },
        select: {
          id: true,
          tenantId: true,
          type: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      res.status(200).json({
        status: "success",
        results: databases.length,
        data: databases,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update tenant database
  async updateTenantDatabase(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, dbId } = req.params

      // Validate request body
      const validatedData = updateTenantDatabaseSchema.parse(req.body)

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Check if database exists
      const existingDatabase = await prisma.tenantDatabase.findFirst({
        where: {
          id: dbId,
          tenantId: id,
        },
      })

      if (!existingDatabase) {
        throw new ApiError(404, "Tenant database not found")
      }

      // Update database
      const database = await prisma.tenantDatabase.update({
        where: { id: dbId },
        data: validatedData,
      })

      // Log database update
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: id,
          action: "database_updated",
          performedBy: req.user?.id,
          details: JSON.stringify({
            databaseId: database.id,
            isActive: database.isActive,
          }),
        },
      })

      // Publish tenant database updated event
      await sendMessage("tenant-events", {
        type: "TENANT_DATABASE_UPDATED",
        data: {
          tenantId: id,
          databaseId: database.id,
          isActive: database.isActive,
          updatedAt: database.updatedAt,
        },
      })

      logger.info(`Tenant database updated: ${database.id} for tenant ${id}`)

      // Don't include connection string in response for security
      const responseData = {
        id: database.id,
        tenantId: database.tenantId,
        type: database.type,
        isActive: database.isActive,
        createdAt: database.createdAt,
        updatedAt: database.updatedAt,
      }

      res.status(200).json({
        status: "success",
        data: responseData,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete tenant database
  async deleteTenantDatabase(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, dbId } = req.params

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      })

      if (!existingTenant) {
        throw new ApiError(404, "Tenant not found")
      }

      // Check if database exists
      const existingDatabase = await prisma.tenantDatabase.findFirst({
        where: {
          id: dbId,
          tenantId: id,
        },
      })

      if (!existingDatabase) {
        throw new ApiError(404, "Tenant database not found")
      }

      // Log database deletion before actual deletion
      await prisma.tenantAuditLog.create({
        data: {
          tenantId: id,
          action: "database_deleted",
          performedBy: req.user?.id,
          details: JSON.stringify({
            databaseId: dbId,
            type: existingDatabase.type,
          }),
        },
      })

      // Publish tenant database deleted event
      await sendMessage("tenant-events", {
        type: "TENANT_DATABASE_DELETED",
        data: {
          tenantId: id,
          databaseId: dbId,
          deletedAt: new Date().toISOString(),
        },
      })

      // Delete database
      await prisma.tenantDatabase.delete({
        where: { id: dbId },
      })

      logger.info(`Tenant database deleted: ${dbId} for tenant ${id}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
