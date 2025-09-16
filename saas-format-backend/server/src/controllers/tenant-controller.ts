import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
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
              // Default settings
              allowSignup: true,
              maxUsers: 5,
              maxProjects: 10,
              maxStorage: 1024, // 1GB
            },
          },
        },
        include: {
          settings: true,
        },
      })

      logger.info(`Tenant created: ${tenant.id} (${tenant.name})`)

      res.status(201).json({
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
          _count: {
            select: {
              users: true,
              projects: true,
            },
          },
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
          _count: {
            select: {
              users: true,
              projects: true,
            },
          },
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

      // Delete tenant (cascade will delete all related data)
      await prisma.tenant.delete({
        where: { id },
      })

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

      // Update or create settings
      const settings = await prisma.tenantSettings.upsert({
        where: { tenantId: id },
        update: validatedData,
        create: {
          tenantId: id,
          ...validatedData,
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
}
