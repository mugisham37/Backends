import type { Request, Response, NextFunction } from "express"
import { ApiError } from "../utils/api-error"

// Extend Express Request interface to include tenant
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string
        name?: string
        slug?: string
        isActive?: boolean
      }
    }
  }
}

export const tenantMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Get tenant identifier from header, subdomain, or path parameter
    const tenantId = (req.headers["x-tenant-id"] as string) || req.params.tenantId

    // Skip tenant middleware for routes that don't require it
    if (!tenantId && (req.path === "/register" || req.path === "/login")) {
      return next()
    }

    if (!tenantId) {
      throw new ApiError(400, "Tenant identifier is required")
    }

    // Attach tenant to request object
    req.tenant = { id: tenantId }
    next()
  } catch (error) {
    next(error)
  }
}
