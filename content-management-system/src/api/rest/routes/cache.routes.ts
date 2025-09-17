import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import type { CacheController } from "../../../modules/cache/cache.controller";

/**
 * Cache Management REST Routes
 *
 * Handles cache operations, session management, and cache administration.
 */
export const cacheRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const cacheController = container.resolve<CacheController>("CacheController");

  // Cache Operations
  fastify.post("/set", cacheController.setCache);
  fastify.get("/:key", cacheController.getCache);
  fastify.delete("/:key", cacheController.deleteCache);
  fastify.post("/delete-multiple", cacheController.deleteMultipleCache);
  fastify.post("/invalidate-pattern", cacheController.invalidatePattern);
  fastify.post("/clear", cacheController.clearCache);

  // Session Management
  fastify.post("/sessions", cacheController.createSession);
  fastify.get("/sessions/:sessionId", cacheController.getSession);
  fastify.put("/sessions/:sessionId", cacheController.updateSession);
  fastify.delete("/sessions/:sessionId", cacheController.deleteSession);

  // Cache Statistics and Monitoring
  fastify.get("/stats", cacheController.getCacheStats);
  fastify.get("/health", cacheController.getCacheHealth);
  fastify.post("/increment/:key", cacheController.incrementCache);
  fastify.post("/expire/:key", cacheController.expireCache);
};
