import type { Request, Response, NextFunction } from "express"
import axios from "axios"
import { logger } from "../utils/logger"
import redisClient from "../utils/redis-client"
import { ApiError } from "./error-handler"

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

export const tenantExtractor = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Get tenant identifier from header, subdomain, or path parameter
    const tenantIdentifier = (req.headers["x-tenant-id"] as string) || req.params.tenantId

    // Skip tenant extraction for auth routes that don't require it
    if (!tenantIdentifier && req.path.startsWith("/api/auth") && !req.path.includes("/me")) {
      return next()
    }

    // Skip tenant extraction for public tenant creation
    if (req.path === "/api/tenants" && req.method === "POST") {
      return next()
    }

    if (!tenantIdentifier) {
      throw new ApiError(400, "Tenant identifier is required")
    }

    // Try to get tenant from cache
    const cachedTenant = await redisClient.get(`tenant:${tenantIdentifier}`)

    if (cachedTenant) {
      req.tenant = JSON.parse(cachedTenant)
      return next()
    }

    // If not in cache, fetch from tenant service
    const tenantServiceUrl = process.env.TENANT_SERVICE_URL || "http://tenant-service:3002"
    const response = await axios.get(`${tenantServiceUrl}/api/tenants/lookup/${tenantIdentifier}`)

    if (response.data && response.data.data) {
      const tenant = response.data.data

      // Cache tenant data
      await redisClient.set(`tenant:${tenantIdentifier}`, JSON.stringify(tenant), "EX", 300) // Cache for 5 minutes

      // Attach tenant to request object
      req.tenant = tenant
      next()
    } else {
      throw new ApiError(404, "Tenant not found or inactive")
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      next(new ApiError(404, "Tenant not found or inactive"))
    } else {
      logger.error(`Tenant extraction error: ${error instanceof Error ? error.message : String(error)}`)
      next(error)
    }
  }
}
