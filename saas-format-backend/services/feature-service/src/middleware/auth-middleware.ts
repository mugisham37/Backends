import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import axios from "axios"
import { logger } from "../utils/logger"
import { ApiError } from "../utils/api-error"

// Extend Express Request interface to include user and tenant
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: string
        tenantId: string
      }
      tenant?: {
        id: string
        name?: string
        slug?: string
        isActive?: boolean
      }
    }
  }
}

interface JwtPayload {
  id: string
  email: string
  role: string
  tenantId: string
}

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Skip auth for OPTIONS requests (CORS preflight)
    if (req.method === "OPTIONS") {
      return next()
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required")
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
      throw new ApiError(401, "Authentication token is required")
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret") as JwtPayload

    // Check if user exists and is active via auth service
    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3001"

    try {
      const response = await axios.get(`${authServiceUrl}/api/auth/validate-token`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.data && response.data.data) {
        // Attach user to request object
        req.user = response.data.data

        // Get tenant information
        const tenantId = req.user.tenantId
        req.tenant = { id: tenantId }

        // Get tenant details from tenant service if needed
        if (req.path !== "/api/features/evaluate") {
          try {
            const tenantServiceUrl = process.env.TENANT_SERVICE_URL || "http://tenant-service:3002"
            const tenantResponse = await axios.get(`${tenantServiceUrl}/api/tenants/${tenantId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })

            if (tenantResponse.data && tenantResponse.data.data) {
              req.tenant = tenantResponse.data.data
            }
          } catch (error) {
            logger.error(`Error fetching tenant details: ${error instanceof Error ? error.message : String(error)}`)
            // Continue even if tenant details fetch fails
          }
        }

        next()
      } else {
        throw new ApiError(401, "Invalid user or token")
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new ApiError(401, "Invalid or expired token")
      } else {
        logger.error(`Auth service error: ${error instanceof Error ? error.message : String(error)}`)
        throw new ApiError(500, "Authentication service unavailable")
      }
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, "Invalid or expired token"))
    } else {
      next(error)
    }
  }
}

// Role-based authorization middleware
export const authorize = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required")
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Insufficient permissions")
    }

    next()
  }
}
