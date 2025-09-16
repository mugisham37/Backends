import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { ApiError } from "../utils/api-error"

interface DecodedToken {
  id: string
  email: string
  role: string
  tenantId: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Unauthorized: No token provided")
    }

    const token = authHeader.split(" ")[1]

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as DecodedToken

    // Add user to request
    req.user = decoded

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, "Unauthorized: Invalid token"))
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError(401, "Unauthorized: Token expired"))
    } else {
      next(error)
    }
  }
}

// Middleware to check if user has required role
export const hasRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Unauthorized: User not authenticated")
      }

      const userRole = req.user.role

      if (Array.isArray(roles)) {
        if (!roles.includes(userRole)) {
          throw new ApiError(403, "Forbidden: Insufficient permissions")
        }
      } else if (roles !== userRole) {
        throw new ApiError(403, "Forbidden: Insufficient permissions")
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
