import type { Request, Response, NextFunction } from "express"
import { ApiError } from "../utils/api-error"

declare global {
  namespace Express {
    interface Request {
      tenantId?: string
    }
  }
}

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get tenant ID from header or user object
    const tenantIdHeader = req.headers["x-tenant-id"] as string
    const tenantIdFromUser = req.user?.tenantId

    // Use tenant ID from header if available, otherwise from user
    const tenantId = tenantIdHeader || tenantIdFromUser

    if (!tenantId) {
      throw new ApiError(400, "Tenant ID is required")
    }

    // Add tenant ID to request
    req.tenantId = tenantId

    next()
  } catch (error) {
    next(error)
  }
}
