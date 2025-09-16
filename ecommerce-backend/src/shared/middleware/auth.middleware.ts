/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication for protected routes
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import { JWTService } from "../../modules/auth/jwt.service.js";
import type { User } from "../../core/database/schema/users.js";

// Extend FastifyRequest to include user
declare module "fastify" {
  interface FastifyRequest {
    user?: Omit<User, "password">;
    userId?: string;
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: Omit<User, "password">;
  userId: string;
}

export class AuthMiddleware {
  constructor(private readonly jwtService: JWTService) {}

  /**
   * Middleware to authenticate requests using JWT
   */
  authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        throw new AppError("Access token required", 401, "TOKEN_REQUIRED");
      }

      // Verify token
      const payload = this.jwtService.verifyAccessToken(token);

      // Add user info to request
      request.userId = payload.userId;
      request.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role as any,
      } as Omit<User, "password">;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Authentication failed", 401, "AUTH_FAILED");
    }
  };

  /**
   * Optional authentication - doesn't throw if no token provided
   */
  optionalAuth = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const authHeader = request.headers.authorization;
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (token) {
        const payload = this.jwtService.verifyAccessToken(token);
        request.userId = payload.userId;
        request.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role as any,
        } as Omit<User, "password">;
      }
    } catch (error) {
      // Silently ignore authentication errors for optional auth
      request.user = undefined;
      request.userId = undefined;
    }
  };

  /**
   * Role-based authorization middleware
   */
  requireRole = (allowedRoles: string[]) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      // Ensure user is authenticated first
      if (!request.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }

      // Check if user has required role
      if (!allowedRoles.includes(request.user.role)) {
        throw new AppError(
          "Insufficient permissions",
          403,
          "INSUFFICIENT_PERMISSIONS",
          { requiredRoles: allowedRoles, userRole: request.user.role }
        );
      }
    };
  };

  /**
   * Admin-only authorization
   */
  requireAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    return this.requireRole(["admin"])(request, reply);
  };

  /**
   * Vendor or Admin authorization
   */
  requireVendorOrAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    return this.requireRole(["vendor", "admin"])(request, reply);
  };

  /**
   * Check if user owns the resource or is admin
   */
  requireOwnershipOrAdmin = (
    getUserIdFromParams: (request: FastifyRequest) => string
  ) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      if (!request.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }

      const resourceUserId = getUserIdFromParams(request);
      const isOwner = request.user.id === resourceUserId;
      const isAdmin = request.user.role === "admin";

      if (!isOwner && !isAdmin) {
        throw new AppError(
          "Access denied - you can only access your own resources",
          403,
          "ACCESS_DENIED"
        );
      }
    };
  };
}

/**
 * Factory function to create auth middleware instance
 */
export const createAuthMiddleware = (
  jwtService: JWTService
): AuthMiddleware => {
  return new AuthMiddleware(jwtService);
};

/**
 * Helper function to extract user ID from request params
 */
export const getUserIdFromParams = (request: FastifyRequest): string => {
  const params = request.params as { userId?: string; id?: string };
  return params.userId || params.id || "";
};

/**
 * Type guard to check if request is authenticated
 */
export const isAuthenticatedRequest = (
  request: FastifyRequest
): request is AuthenticatedRequest => {
  return !!request.user && !!request.userId;
};
