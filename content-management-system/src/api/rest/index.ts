import type { FastifyInstance } from "fastify";
import { auditRoutes } from "./routes/audit.routes";
import { authRoutes } from "./routes/auth.routes";
import { cacheRoutes } from "./routes/cache.routes";
import { contentRoutes } from "./routes/content.routes";
import { healthRoutes } from "./routes/health.routes";
import { mediaRoutes } from "./routes/media.routes";
import { performanceRoutes } from "./routes/performance.routes";
import { searchRoutes } from "./routes/search.routes";
import { tenantRoutes } from "./routes/tenant.routes";
import { webhookRoutes } from "./routes/webhook.routes";

/**
 * Setup REST API routes
 * Registers all REST route plugins with the Fastify instance
 */
export const setupRestApi = async (fastify: FastifyInstance): Promise<void> => {
  // Register API v1 routes
  await fastify.register(
    async (fastifyInstance) => {
      // Core authentication and authorization
      await fastifyInstance.register(authRoutes, { prefix: "/auth" });

      // Content management
      await fastifyInstance.register(contentRoutes, { prefix: "/content" });

      // Media management
      await fastifyInstance.register(mediaRoutes, { prefix: "/media" });

      // Multi-tenancy
      await fastifyInstance.register(tenantRoutes, { prefix: "/tenants" });

      // Search functionality
      await fastifyInstance.register(searchRoutes, { prefix: "/search" });

      // Webhooks
      await fastifyInstance.register(webhookRoutes, { prefix: "/webhooks" });

      // Cache management
      await fastifyInstance.register(cacheRoutes, { prefix: "/cache" });

      // Audit logging
      await fastifyInstance.register(auditRoutes, { prefix: "/audit" });

      // Health monitoring
      await fastifyInstance.register(healthRoutes, { prefix: "/health" });

      // Performance monitoring
      await fastifyInstance.register(performanceRoutes, {
        prefix: "/performance",
      });
    },
    { prefix: "/api/v1" }
  );
};
