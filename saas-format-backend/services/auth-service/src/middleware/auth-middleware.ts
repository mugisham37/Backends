import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
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

    // Check if user exists and is active
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.id,
        isActive: true,
        tenantId: decoded.tenantId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
      },
    })

    if (!user) {
      throw new ApiError(401, "User not found or inactive")
    }

    // Attach user to request object
    req.user = user
    next()
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
