import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { container } from "tsyringe";
import { config } from "../config";
import { UserRepository } from "../../core/repositories/user.repository";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";

// Interface for decoded JWT token
interface DecodedToken {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

// Middleware to authenticate requests
export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue as unauthenticated
      return next();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as DecodedToken;

      // Get user repository from container
      const userRepository = container.resolve(UserRepository);

      // Find user
      const userResult = await userRepository.findById(decoded.id);

      if (!userResult.success || !userResult.data) {
        return next();
      }

      // Attach user to request (excluding password)
      const { passwordHash, ...userWithoutPassword } = userResult.data;
      (req as any).user = userWithoutPassword;
      (req as any).token = token;

      next();
    } catch (_error) {
      // Invalid token, continue as unauthenticated
      return next();
    }
  } catch (error) {
    logger.error("Auth middleware error:", error);
    next(error);
  }
};

// Middleware to require authentication
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!(req as any).user) {
    return next(ApiError.unauthorized("Authentication required"));
  }

  next();
};

// Middleware to require specific roles
export const requireRoles = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    const userRole = (req as any).user.role;

    if (!roles.includes(userRole)) {
      return next(
        ApiError.forbidden("You do not have permission to perform this action")
      );
    }

    next();
  };
};

// Middleware to require API key authentication
export const requireApiKey = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return next(ApiError.unauthorized("API key required"));
    }

    // Find API key in database
    // This is a placeholder - implement actual API key validation
    const validApiKey = true; // Replace with actual validation

    if (!validApiKey) {
      return next(ApiError.unauthorized("Invalid API key"));
    }
    // Attach API key info to request
    (req as any).apiKey = {
      id: "api-key-id",
      permissions: ["read", "write"], // Example permissions
    };

    next();
  } catch (error) {
    logger.error("API key middleware error:", error);
    next(error);
  }
};
