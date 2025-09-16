import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { auditRoutes } from "./routes/audit.routes";
import { authRoutes } from "./routes/auth.routes";
import { contentRoutes } from "./routes/content.routes";
import { mediaRoutes } from "./routes/media.routes";
import { searchRoutes } from "./routes/search.routes";
import { tenantRoutes } from "./routes/tenant.routes";
import { webhookRoutes } from "./routes/webhook.routes";

/**
 * REST API Plugin for Fastify
 *
 * Consolidates all REST endpoints into a single plugin with proper
 * middleware, validation, and error handling.
 */
export const restApiPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Add REST API specific hooks
  fastify.addHook("preHandler", async (_request, reply) => {
    // Add REST-specific headers
    reply.header("content-type", "application/json");
    reply.header("x-api-type", "rest");
  });

  // Register validation schemas
  await registerSchemas(fastify);

  // Register route modules
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(contentRoutes, { prefix: "/content" });
  await fastify.register(mediaRoutes, { prefix: "/media" });
  await fastify.register(tenantRoutes, { prefix: "/tenants" });
  await fastify.register(searchRoutes, { prefix: "/search" });
  await fastify.register(webhookRoutes, { prefix: "/webhooks" });
  await fastify.register(auditRoutes, { prefix: "/audit" });

  // REST API documentation endpoint
  fastify.get("/docs", async (_request, reply) => {
    return reply.status(200).send({
      title: "REST API Documentation",
      version: "v1",
      description: "RESTful API endpoints for the Content Management System",
      endpoints: {
        auth: "/auth - Authentication and authorization",
        content: "/content - Content management operations",
        media: "/media - File upload and media management",
        tenants: "/tenants - Multi-tenant operations",
        search: "/search - Search and filtering",
        webhooks: "/webhooks - Webhook management",
        audit: "/audit - Audit logs and monitoring",
      },
      timestamp: new Date().toISOString(),
    });
  });
};

/**
 * Register JSON schemas for request/response validation
 */
async function registerSchemas(fastify: FastifyInstance): Promise<void> {
  // Common schemas
  const errorSchema = {
    $id: "error",
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
      timestamp: { type: "string" },
      details: { type: "object" },
    },
    required: ["error", "message", "timestamp"],
  };

  const successSchema = {
    $id: "success",
    type: "object",
    properties: {
      success: { type: "boolean" },
      data: { type: "object" },
      timestamp: { type: "string" },
    },
    required: ["success", "timestamp"],
  };

  // Register schemas
  fastify.addSchema(errorSchema);
  fastify.addSchema(successSchema);
}
