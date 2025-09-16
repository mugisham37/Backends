import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"

// Extend Express Request interface to include tenant
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string
        name: string
        slug: string
        isActive: boolean
      }
    }
  }
}

export const tenantMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Get tenant identifier from header, subdomain, or path parameter
    const tenantIdentifier = (req.headers["x-tenant-id"] as string) || req.params.tenantId

    if (!tenantIdentifier) {
      throw new ApiError(400, "Tenant identifier is required")
    }

    // Find tenant by slug or id
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id: tenantIdentifier }, { slug: tenantIdentifier }, { domain: tenantIdentifier }],
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

    // Attach tenant to request object
    req.tenant = tenant
    next()
  } catch (error) {
    next(error)
  }
}
