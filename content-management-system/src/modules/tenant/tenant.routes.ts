import type { FastifyInstance } from "fastify";
import { container } from "tsyringe";
import { TenantController } from "./tenant.controller";
import {
  createTenantSchema,
  updateTenantSchema,
  tenantQuerySchema,
  updateTenantSettingsSchema,
  tenantParamsSchema,
  tenantSlugParamsSchema,
} from "./tenant.schemas";

/**
 * Tenant routes plugin for Fastify
 * Registers all tenant-related routes with proper validation and authentication
 */
export async function tenantRoutes(fastify: FastifyInstance) {
  const tenantController = container.resolve(TenantController);

  // Apply authentication middleware to all routes
  await fastify.register(async function (fastify) {
    // Add preHandler for authentication on all routes
    fastify.addHook("preHandler", fastify.authenticate);

    // Create tenant
    fastify.post(
      "/tenants",
      {
        schema: {
          body: createTenantSchema,
          response: {
            201: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    tenant: { type: "object" },
                  },
                },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.createTenant
    );

    // Get user tenants
    fastify.get(
      "/tenants/my",
      {
        schema: {
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    tenants: { type: "array" },
                  },
                },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.getUserTenants
    );

    // List tenants with pagination and filtering
    fastify.get(
      "/tenants",
      {
        schema: {
          querystring: tenantQuerySchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: { type: "object" },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.listTenants
    );

    // Get tenant by ID
    fastify.get(
      "/tenants/:id",
      {
        schema: {
          params: tenantParamsSchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    tenant: { type: "object" },
                  },
                },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.getTenantById
    );

    // Get tenant by slug
    fastify.get(
      "/tenants/slug/:slug",
      {
        schema: {
          params: tenantSlugParamsSchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    tenant: { type: "object" },
                  },
                },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.getTenantBySlug
    );

    // Update tenant
    fastify.put(
      "/tenants/:id",
      {
        schema: {
          params: tenantParamsSchema,
          body: updateTenantSchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    tenant: { type: "object" },
                  },
                },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.updateTenant
    );

    // Delete tenant
    fastify.delete(
      "/tenants/:id",
      {
        schema: {
          params: tenantParamsSchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                message: { type: "string" },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.deleteTenant
    );

    // Get tenant statistics
    fastify.get(
      "/tenants/:id/stats",
      {
        schema: {
          params: tenantParamsSchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: { type: "object" },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.getTenantStats
    );

    // Update tenant settings
    fastify.patch(
      "/tenants/:id/settings",
      {
        schema: {
          params: tenantParamsSchema,
          body: updateTenantSettingsSchema,
          response: {
            200: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    tenant: { type: "object" },
                  },
                },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      tenantController.updateTenantSettings
    );
  });
}
