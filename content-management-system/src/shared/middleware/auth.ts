import type { FastifyRequest, FastifyReply } from "fastify";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { container } from "tsyringe";
import { config } from "../config";
import { UserRepository } from "../../core/repositories/user.repository";
import { ApiKeyService } from "../services/api-key.service";
import { TOKENS } from "../../core/container";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Enhanced Authentication Middleware
 * Supports both Fastify and Express, with comprehensive auth features
 */

// Interfaces for authentication
export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
  };
  apiKey?: {
    id: string;
    scopes: string[];
    tenantId?: string;
  };
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
  iat: number;
  exp: number;
}

interface DecodedToken {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Fastify JWT Authentication Middleware
 * Enhanced version with proper JWT validation and error handling
 */
export const fastifyAuthMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid authorization header" });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const secretKey =
      process.env["JWT_SECRET"] ||
      config.jwt?.secret ||
      "default-secret-key-change-in-production";
    const decoded = jwt.verify(token, secretKey) as JWTPayload;

    // Get user from database for additional validation
    try {
      const userRepository = container.resolve<UserRepository>(
        TOKENS.UserRepository
      );
      const userResult = await userRepository.findById(decoded.sub);

      if (userResult.success && userResult.data) {
        // Attach validated user information to request
        (request as AuthenticatedRequest).user = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          ...(decoded.tenantId && { tenantId: decoded.tenantId }),
        };

        logger.debug("User authenticated successfully", {
          userId: decoded.sub,
          email: decoded.email,
          tenantId: decoded.tenantId,
        });
      } else {
        reply.code(401).send({ error: "User not found" });
        return;
      }
    } catch (dbError) {
      // If DB check fails, still allow with token data but log warning
      logger.warn("Database validation failed, proceeding with token data", {
        error: dbError,
      });
      (request as AuthenticatedRequest).user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        ...(decoded.tenantId && { tenantId: decoded.tenantId }),
      };
    }
  } catch (error) {
    logger.warn("Authentication failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      token: request.headers.authorization?.substring(0, 20) + "...",
    });

    if (error instanceof jwt.TokenExpiredError) {
      reply.code(401).send({ error: "Token expired" });
    } else if (error instanceof jwt.JsonWebTokenError) {
      reply.code(401).send({ error: "Invalid token" });
    } else {
      reply.code(401).send({ error: "Authentication failed" });
    }
    return;
  }
};

/**
 * Optional Fastify Authentication - doesn't fail if no token
 */
export const fastifyOptionalAuthMiddleware = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const secretKey =
        process.env["JWT_SECRET"] ||
        config.jwt?.secret ||
        "default-secret-key-change-in-production";
      const decoded = jwt.verify(token, secretKey) as JWTPayload;

      (request as AuthenticatedRequest).user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        ...(decoded.tenantId && { tenantId: decoded.tenantId }),
      };

      logger.debug("Optional authentication successful", {
        userId: decoded.sub,
      });
    } catch (error) {
      logger.debug("Optional authentication failed, continuing without user", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

/**
 * Express-compatible authentication middleware
 */
export const expressAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as DecodedToken;
      const userRepository = container.resolve(UserRepository);
      const userResult = await userRepository.findById(decoded.id);

      if (!userResult.success || !userResult.data) {
        return next();
      }

      const { passwordHash, ...userWithoutPassword } = userResult.data;
      (req as any).user = userWithoutPassword;
      (req as any).token = token;

      next();
    } catch (_error) {
      return next();
    }
  } catch (error) {
    logger.error("Auth middleware error:", error);
    next(error);
  }
};

/**
 * Require authentication middleware for Express
 */
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

/**
 * Require authentication middleware for Fastify
 */
export const fastifyRequireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  if (!(request as AuthenticatedRequest).user) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
      timestamp: new Date().toISOString(),
    });
    return;
  }
};

/**
 * Role-based access control for Express
 */
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

/**
 * Role-based access control for Fastify
 */
export const fastifyRequireRoles = (roles: string[]) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const user = (request as AuthenticatedRequest).user;

    if (!user) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!roles.includes(user.role)) {
      reply.code(403).send({
        error: "Forbidden",
        message: "You do not have permission to perform this action",
        timestamp: new Date().toISOString(),
      });
      return;
    }
  };
};

/**
 * API Key authentication middleware for Express
 */
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

    try {
      const apiKeyService = container.resolve<ApiKeyService>(
        TOKENS.ApiKeyService
      );
      const validApiKey = await apiKeyService.validateApiKey(apiKey);

      (req as any).apiKey = {
        id: validApiKey._id,
        scopes: validApiKey.scopes,
        tenantId: validApiKey.tenantId,
      };

      next();
    } catch (error) {
      return next(ApiError.unauthorized("Invalid API key"));
    }
  } catch (error) {
    logger.error("API key middleware error:", error);
    next(error);
  }
};

/**
 * API Key authentication middleware for Fastify
 */
export const fastifyRequireApiKey = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const apiKey = request.headers["x-api-key"] as string;

    if (!apiKey) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "API key required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const apiKeyService = container.resolve<ApiKeyService>(
        TOKENS.ApiKeyService
      );
      const validApiKey = await apiKeyService.validateApiKey(apiKey);

      (request as AuthenticatedRequest).apiKey = {
        id: validApiKey._id,
        scopes: validApiKey.scopes,
        ...(validApiKey.tenantId && { tenantId: validApiKey.tenantId }),
      };
    } catch (error) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid API key",
        timestamp: new Date().toISOString(),
      });
      return;
    }
  } catch (error) {
    logger.error("API key middleware error:", error);
    reply.code(500).send({
      error: "Internal Server Error",
      message: "Authentication service error",
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Combined authentication middleware - supports both JWT and API key for Fastify
 */
export const fastifyFlexibleAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const authHeader = request.headers.authorization;
  const apiKey = request.headers["x-api-key"] as string;

  // Try JWT first
  if (authHeader?.startsWith("Bearer ")) {
    try {
      await fastifyAuthMiddleware(request, reply);
      return;
    } catch (error) {
      // JWT failed, try API key if available
    }
  }

  // Try API key
  if (apiKey) {
    try {
      await fastifyRequireApiKey(request, reply);
      return;
    } catch (error) {
      // API key failed
    }
  }

  // No valid authentication found
  reply.code(401).send({
    error: "Unauthorized",
    message: "Valid JWT token or API key required",
    timestamp: new Date().toISOString(),
  });
};

// Legacy middleware aliases for backward compatibility
export const authMiddleware = expressAuthMiddleware;
