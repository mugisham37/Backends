import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import axios from "axios"
import { logger } from "../utils/logger"
import { ApiError } from "./error-handler"
import redisClient from "../utils/redis-client"

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: string
        tenantId: string
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

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`)
    if (isBlacklisted) {
      throw new ApiError(401, "Token has been revoked")
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
