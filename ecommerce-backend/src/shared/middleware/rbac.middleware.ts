/**
 * RBAC Authorization Middleware
 * Enhanced middleware for role-based and permission-based access control
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import { RBACService } from "../../modules/auth/rbac.service.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export interface RBACOptions {
  roles?: string[];
  permissions?: Array<{ resource: string; action: string }>;
  requireAll?: boolean; // If true, user must have ALL specified roles/permissions
}

export class RBACMiddleware {
  constructor(private readonly rbacService: RBACService) {}

  /**
   * Check if user has required roles
   */
  requireRoles = (roleNames: string[], requireAll = false) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const authRequest = request as AuthenticatedRequest;

      if (!authRequest.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }

      if (requireAll) {
        // User must have ALL specified roles
        for (const roleName of roleNames) {
          const hasRole = await this.rbacService.hasRole(authRequest.user.id, [
            roleName,
          ]);
          if (!hasRole) {
            throw new AppError(
              `Missing required role: ${roleName}`,
              403,
              "INSUFFICIENT_PERMISSIONS",
              { requiredRoles: roleNames, missingRole: roleName }
            );
          }
        }
      } else {
        // User must have at least ONE of the specified roles
        const hasAnyRole = await this.rbacService.hasRole(
          authRequest.user.id,
          roleNames
        );
        if (!hasAnyRole) {
          throw new AppError(
            "Insufficient role permissions",
            403,
            "INSUFFICIENT_PERMISSIONS",
            { requiredRoles: roleNames }
          );
        }
      }
    };
  };

  /**
   * Check if user has required permissions
   */
  requirePermissions = (
    permissions: Array<{ resource: string; action: string }>,
    requireAll = false
  ) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const authRequest = request as AuthenticatedRequest;

      if (!authRequest.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }

      if (requireAll) {
        // User must have ALL specified permissions
        for (const permission of permissions) {
          const hasPermission = await this.rbacService.hasPermission(
            authRequest.user.id,
            permission.resource,
            permission.action
          );
          if (!hasPermission) {
            throw new AppError(
              `Missing required permission: ${permission.resource}:${permission.action}`,
              403,
              "INSUFFICIENT_PERMISSIONS",
              {
                requiredPermissions: permissions,
                missingPermission: permission,
              }
            );
          }
        }
      } else {
        // User must have at least ONE of the specified permissions
        let hasAnyPermission = false;
        for (const permission of permissions) {
          const hasPermission = await this.rbacService.hasPermission(
            authRequest.user.id,
            permission.resource,
            permission.action
          );
          if (hasPermission) {
            hasAnyPermission = true;
            break;
          }
        }

        if (!hasAnyPermission) {
          throw new AppError(
            "Insufficient permissions",
            403,
            "INSUFFICIENT_PERMISSIONS",
            { requiredPermissions: permissions }
          );
        }
      }
    };
  };

  /**
   * Check resource ownership or admin access
   */
  requireOwnershipOrAdmin = (
    getResourceUserId: (request: FastifyRequest) => string | Promise<string>
  ) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const authRequest = request as AuthenticatedRequest;

      if (!authRequest.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }

      // Check if user is admin
      const isAdmin = await this.rbacService.hasRole(authRequest.user.id, [
        "admin",
      ]);
      if (isAdmin) {
        return; // Admin can access any resource
      }

      // Check ownership
      const resourceUserId = await getResourceUserId(request);
      if (authRequest.user.id !== resourceUserId) {
        throw new AppError(
          "Access denied - you can only access your own resources",
          403,
          "ACCESS_DENIED"
        );
      }
    };
  };

  /**
   * Admin-only access
   */
  requireAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    return this.requireRoles(["admin"])(request, reply);
  };

  /**
   * Vendor or Admin access
   */
  requireVendorOrAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    return this.requireRoles(["vendor", "admin"])(request, reply);
  };
}

/**
 * Factory function to create RBAC middleware
 */
export const createRBACMiddleware = (
  rbacService: RBACService
): RBACMiddleware => {
  return new RBACMiddleware(rbacService);
};

/**
 * Helper functions for common permission checks
 */
export const commonPermissions = {
  // User management
  createUser: { resource: "users", action: "create" },
  readUser: { resource: "users", action: "read" },
  updateUser: { resource: "users", action: "update" },
  deleteUser: { resource: "users", action: "delete" },

  // Product management
  createProduct: { resource: "products", action: "create" },
  readProduct: { resource: "products", action: "read" },
  updateProduct: { resource: "products", action: "update" },
  deleteProduct: { resource: "products", action: "delete" },

  // Order management
  createOrder: { resource: "orders", action: "create" },
  readOrder: { resource: "orders", action: "read" },
  updateOrder: { resource: "orders", action: "update" },
  deleteOrder: { resource: "orders", action: "delete" },

  // Vendor management
  createVendor: { resource: "vendors", action: "create" },
  readVendor: { resource: "vendors", action: "read" },
  updateVendor: { resource: "vendors", action: "update" },
  deleteVendor: { resource: "vendors", action: "delete" },

  // Admin functions
  manageRoles: { resource: "roles", action: "manage" },
  viewAnalytics: { resource: "analytics", action: "read" },
  systemConfig: { resource: "system", action: "configure" },
};
