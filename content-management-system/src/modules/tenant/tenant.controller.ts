import type { FastifyRequest, FastifyReply } from "fastify";
import { inject, injectable } from "tsyringe";
import { TenantService } from "./tenant.service";
import { parsePaginationParams } from "../../shared/utils/helpers";
import type { User } from "../../core/repositories/user.repository";
import { Auth } from "../../core/decorators/auth.decorator";

// Type definitions for Fastify requests
interface TenantQueryParams extends Record<string, unknown> {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  isActive?: string;
}

interface TenantParams {
  id?: string;
  slug?: string;
  userId?: string;
}

interface CreateTenantBody {
  name: string;
  slug?: string;
  description?: string;
  domain?: string;
  subdomain?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface UpdateTenantBody {
  name?: string;
  description?: string;
  domain?: string;
  subdomain?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

interface UpdateTenantSettingsBody {
  settings: Record<string, any>;
}

/**
 * Tenant controller for Fastify
 * Handles tenant management operations with proper authentication and validation
 */
@injectable()
@Auth()
export class TenantController {
  constructor(@inject("TenantService") private tenantService: TenantService) {}

  /**
   * Create a new tenant
   */
  public createTenant = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const user = request.user as User;
      const tenantData = request.body as CreateTenantBody;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.createTenant({
        name: tenantData.name,
        ...(tenantData.slug && { slug: tenantData.slug }),
        ...(tenantData.description && { description: tenantData.description }),
        ...(tenantData.domain && { domain: tenantData.domain }),
        ...(tenantData.subdomain && { subdomain: tenantData.subdomain }),
        ...(tenantData.settings && { settings: tenantData.settings }),
        ...(tenantData.metadata && { metadata: tenantData.metadata }),
      });

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          tenant: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error creating tenant: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get tenant by ID
   */
  public getTenantById = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params as TenantParams;
      const user = request.user as User;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Tenant ID is required",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has access to this tenant
      const memberResult = await this.tenantService.isUserMemberOfTenant(
        id,
        user.id
      );
      if (!memberResult.success || !memberResult.data) {
        return reply.status(403).send({
          status: "error",
          message: "You do not have access to this tenant",
          code: "FORBIDDEN",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.getTenantById(id);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          tenant: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error getting tenant: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get tenant by slug
   */
  public getTenantBySlug = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { slug } = request.params as TenantParams;
      const user = request.user as User;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      if (!slug) {
        return reply.status(400).send({
          status: "error",
          message: "Tenant slug is required",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.getTenantBySlug(slug);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has access to this tenant
      const memberResult = await this.tenantService.isUserMemberOfTenant(
        result.data.id,
        user.id
      );
      if (!memberResult.success || !memberResult.data) {
        return reply.status(403).send({
          status: "error",
          message: "You do not have access to this tenant",
          code: "FORBIDDEN",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          tenant: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error getting tenant by slug: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Update tenant
   */
  public updateTenant = async (
    request: FastifyRequest<{
      Params: TenantParams;
      Body: UpdateTenantBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const user = request.user as User;
      const updateData = request.body;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Tenant ID is required",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has access to this tenant
      const memberResult = await this.tenantService.isUserMemberOfTenant(
        id,
        user.id
      );
      if (!memberResult.success || !memberResult.data) {
        return reply.status(403).send({
          status: "error",
          message: "You do not have access to this tenant",
          code: "FORBIDDEN",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.updateTenant(id, updateData);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          tenant: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error updating tenant: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Delete tenant (soft delete by deactivating)
   */
  public deleteTenant = async (
    request: FastifyRequest<{
      Params: TenantParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const user = request.user as User;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Tenant ID is required",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has access to this tenant
      const memberResult = await this.tenantService.isUserMemberOfTenant(
        id,
        user.id
      );
      if (!memberResult.success || !memberResult.data) {
        return reply.status(403).send({
          status: "error",
          message: "You do not have access to this tenant",
          code: "FORBIDDEN",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.deleteTenant(id);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        message: "Tenant deleted successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error deleting tenant: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * List tenants with pagination and filtering
   */
  public listTenants = async (
    request: FastifyRequest<{
      Querystring: TenantQueryParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const user = request.user as User;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      // Parse query parameters
      const { page, limit } = parsePaginationParams(request.query);

      // Build filter options
      const options: any = {
        page,
        limit,
        search: request.query.search as string,
        isActive: request.query.isActive
          ? request.query.isActive === "true"
          : undefined,
      };

      const result = await this.tenantService.listTenants(options);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error listing tenants: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get user tenants
   */
  public getUserTenants = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const user = request.user as User;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.getUserTenants(user.id);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          tenants: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error getting user tenants: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get tenant statistics
   */
  public getTenantStats = async (
    request: FastifyRequest<{
      Params: TenantParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const user = request.user as User;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Tenant ID is required",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has access to this tenant
      const memberResult = await this.tenantService.isUserMemberOfTenant(
        id,
        user.id
      );
      if (!memberResult.success || !memberResult.data) {
        return reply.status(403).send({
          status: "error",
          message: "You do not have access to this tenant",
          code: "FORBIDDEN",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.getTenantStats(id);

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error getting tenant stats: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Update tenant settings
   */
  public updateTenantSettings = async (
    request: FastifyRequest<{
      Params: TenantParams;
      Body: UpdateTenantSettingsBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const user = request.user as User;
      const { settings } = request.body;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          code: "UNAUTHORIZED",
          timestamp: new Date().toISOString(),
        });
      }

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Tenant ID is required",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user has access to this tenant
      const memberResult = await this.tenantService.isUserMemberOfTenant(
        id,
        user.id
      );
      if (!memberResult.success || !memberResult.data) {
        return reply.status(403).send({
          status: "error",
          message: "You do not have access to this tenant",
          code: "FORBIDDEN",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.tenantService.updateTenantSettings(
        id,
        settings
      );

      if (!result.success) {
        const statusCode = this.getErrorStatusCode(result.error);
        return reply.status(statusCode).send({
          status: "error",
          message: result.error.message,
          code: result.error.constructor.name,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          tenant: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(`Error updating tenant settings: ${error}`);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Helper method to map errors to HTTP status codes
   */
  private getErrorStatusCode(error: Error): number {
    const errorName = error.constructor.name;

    switch (errorName) {
      case "NotFoundError":
        return 404;
      case "ConflictError":
        return 409;
      case "ValidationError":
        return 400;
      case "BusinessRuleError":
        return 422;
      case "UnauthorizedError":
        return 401;
      case "ForbiddenError":
        return 403;
      default:
        return 500;
    }
  }
}
