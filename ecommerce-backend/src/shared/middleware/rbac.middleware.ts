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
          const hasRole = await this.rbacService.hasRole(
            authRequest.user.id,
            [roleName]
          );
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
        throw new AppError("Aut