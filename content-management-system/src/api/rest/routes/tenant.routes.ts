import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import { TenantController } from "../../../modules/tenant/tenant.controller";
import { validate } from "../../../shared/middleware/zod-validation";
import {
  createTenantSchema,
  updateTenantSchema,
  tenantQuerySchema,
  updateTenantSettingsSchema,
  tenantParamsSchema,
  tenantSlugParamsSchema,
} from "../../../modules/tenant/tenant.schemas";

// Type definitions
interface TenantQueryParams extends Record<string, unknown> {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  isActive?: string;
}

interface TenantParams {
  id: string;
  slug?: string;
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
 * Tenant routes plugin for Fastify
 * Registers all tenant-related routes with proper validation and authentication
 */
export const tenantRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const tenantController = container.resolve(TenantController);

  // Get user tenants
  fastify.get(
    "/my",
    {
      preHandler: [fastify.authenticate],
    },
    tenantController.getUserTenants
  );

  // List tenants with pagination and filtering
  fastify.get<{
    Querystring: TenantQueryParams;
  }>(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        validate({ querystring: tenantQuerySchema }),
      ],
    },
    tenantController.listTenants
  );

  // Create tenant
  fastify.post(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        validate({ body: createTenantSchema }),
      ],
    },
    tenantController.createTenant
  );

  // Get tenant by slug
  fastify.get(
    "/slug/:slug",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: tenantSlugParamsSchema }),
      ],
    },
    tenantController.getTenantBySlug
  );

  // Get tenant by ID
  fastify.get(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: tenantParamsSchema }),
      ],
    },
    tenantController.getTenantById
  );

  // Update tenant
  fastify.put<{
    Params: TenantParams;
    Body: UpdateTenantBody;
  }>(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({
          params: tenantParamsSchema,
          body: updateTenantSchema,
        }),
      ],
    },
    tenantController.updateTenant
  );

  // Delete tenant
  fastify.delete<{
    Params: TenantParams;
  }>(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: tenantParamsSchema }),
      ],
    },
    tenantController.deleteTenant
  );

  // Get tenant statistics
  fastify.get<{
    Params: TenantParams;
  }>(
    "/:id/stats",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: tenantParamsSchema }),
      ],
    },
    tenantController.getTenantStats
  );

  // Update tenant settings
  fastify.patch<{
    Params: TenantParams;
    Body: UpdateTenantSettingsBody;
  }>(
    "/:id/settings",
    {
      preHandler: [
        fastify.authenticate,
        validate({
          params: tenantParamsSchema,
          body: updateTenantSettingsSchema,
        }),
      ],
    },
    tenantController.updateTenantSettings
  );
};
