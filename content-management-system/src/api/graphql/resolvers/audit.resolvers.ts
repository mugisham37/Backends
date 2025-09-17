import { container } from "tsyringe";
import type { AuditService } from "../../../modules/audit/audit.service";
import type { GraphQLContext } from "../context";

/**
 * GraphQL Resolvers for Audit Module
 *
 * Handles audit log queries and management through GraphQL API.
 */

export const auditResolvers = {
  Query: {
    /**
     * Get audit logs with optional filtering
     */
    auditLogs: async (
      _parent: any,
      args: {
        tenantId?: string;
        entityType?: string;
        entityId?: string;
        action?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        type?: string;
        severity?: "low" | "medium" | "high" | "critical";
      },
      context: GraphQLContext
    ) => {
      const auditService = container.resolve<AuditService>("AuditService");
      const {
        tenantId = context.user?.tenantId,
        entityType,
        entityId,
        action,
        userId,
        startDate,
        endDate,
        limit = 50,
        type,
        severity,
      } = args;

      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      const result = await auditService.getAuditLogs({
        ...(tenantId && { tenantId }),
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
        ...(action && { action }),
        ...(userId && { userId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        limit,
        ...(type && { type: type as any }),
        ...(severity && { severity }),
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch audit logs");
      }

      return {
        logs: result.data,
        totalCount: result.data.length,
        hasMore: result.data.length >= limit,
      };
    },

    /**
     * Get system health metrics
     */
    systemHealth: async (
      _parent: any,
      _args: any,
      _context: GraphQLContext
    ) => {
      const auditService = container.resolve<AuditService>("AuditService");

      const result = await auditService.getSystemHealth();

      if (!result.success) {
        throw new Error(
          result.error?.message || "Failed to fetch system health"
        );
      }

      return result.data;
    },
  },

  Mutation: {
    /**
     * Log a user action
     */
    logUserAction: async (
      _parent: any,
      args: {
        input: {
          action: string;
          resource?: string;
          details?: Record<string, any>;
          severity?: "low" | "medium" | "high" | "critical";
        };
      },
      context: GraphQLContext
    ) => {
      const auditService = container.resolve<AuditService>("AuditService");

      if (!context.user?.id || !context.user?.tenantId) {
        throw new Error("Authentication required");
      }

      const result = await auditService.logUserAction({
        userId: context.user.id,
        tenantId: context.user.tenantId,
        action: args.input.action,
        resource: args.input.resource || "",
        details: args.input.details || {},
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to log user action");
      }

      return { success: true, message: "User action logged successfully" };
    },
  },

  // Field resolvers for audit log relationships
  AuditLog: {
    user: async (parent: any, _args: any, context: GraphQLContext) => {
      if (!parent.userId) return null;
      return context.loaders.userLoader.load(parent.userId);
    },

    tenant: async (parent: any, _args: any, context: GraphQLContext) => {
      return context.loaders.tenantLoader.load(parent.tenantId);
    },

    entity: async (parent: any, _args: any, context: GraphQLContext) => {
      // Dynamically resolve the entity based on entityType from details
      const entityType = parent.details?.entityType;
      const entityId = parent.details?.entityId;

      if (!entityType || !entityId) return null;

      switch (entityType) {
        case "Content":
          return context.loaders.contentLoader.load(entityId);
        case "Media":
          return context.loaders.mediaLoader.load(entityId);
        case "User":
          return context.loaders.userLoader.load(entityId);
        case "Tenant":
          return context.loaders.tenantLoader.load(entityId);
        default:
          return null;
      }
    },
  },
};
