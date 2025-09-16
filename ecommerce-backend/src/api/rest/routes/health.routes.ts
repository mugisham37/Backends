/**
 * Health check REST API routes
 * System monitoring and status endpoints - Fastify version
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils.js";

export async function healthRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Basic health check
  fastify.get("/", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const health = {
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || "1.0.0",
          environment: process.env.NODE_ENV || "development",
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(health, { requestId: (request as any).id })
          );
      } catch (error) {
        return reply
          .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
          .send(
            ResponseBuilder.error("Health check failed", "HEALTH_CHECK_FAILED")
          );
      }
    },
  });

  // Detailed health check with system info
  fastify.get("/detailed", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const health = {
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || "1.0.0",
          environment: process.env.NODE_ENV || "development",
          system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: {
              used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
              external: Math.round(
                process.memoryUsage().external / 1024 / 1024
              ),
            },
            cpu: process.cpuUsage(),
          },
          services: {
            database: await checkDatabaseHealth(),
            redis: await checkRedisHealth(),
            storage: await checkStorageHealth(),
          },
        };

        const allServicesHealthy = Object.values(health.services).every(
          (service: any) => service.status === "healthy"
        );

        const statusCode = allServicesHealthy
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

        return reply
          .status(statusCode)
          .send(
            ResponseBuilder.success(health, { requestId: (request as any).id })
          );
      } catch (error) {
        return reply
          .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
          .send(
            ResponseBuilder.error(
              "Detailed health check failed",
              "DETAILED_HEALTH_CHECK_FAILED"
            )
          );
      }
    },
  });

  // Readiness probe for Kubernetes
  fastify.get("/ready", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if all critical services are ready
        const services = {
          database: await checkDatabaseHealth(),
          redis: await checkRedisHealth(),
        };

        const allReady = Object.values(services).every(
          (service: any) => service.status === "healthy"
        );

        const readiness = {
          ready: allReady,
          timestamp: new Date().toISOString(),
          services,
        };

        const statusCode = allReady
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

        return reply
          .status(statusCode)
          .send(
            ResponseBuilder.success(readiness, {
              requestId: (request as any).id,
            })
          );
      } catch (error) {
        return reply
          .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
          .send(
            ResponseBuilder.error(
              "Readiness check failed",
              "READINESS_CHECK_FAILED"
            )
          );
      }
    },
  });

  // Liveness probe for Kubernetes
  fastify.get("/live", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const liveness = {
          alive: true,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          pid: process.pid,
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(liveness, {
              requestId: (request as any).id,
            })
          );
      } catch (error) {
        return reply
          .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
          .send(
            ResponseBuilder.error(
              "Liveness check failed",
              "LIVENESS_CHECK_FAILED"
            )
          );
      }
    },
  });
}

// Helper functions for service health checks
async function checkDatabaseHealth(): Promise<{
  status: string;
  message?: string;
  responseTime?: number;
}> {
  try {
    const start = Date.now();
    // TODO: Implement actual database health check
    // await db.select().from(someTable).limit(1);
    const responseTime = Date.now() - start;

    return {
      status: "healthy",
      responseTime,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message:
        error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

async function checkRedisHealth(): Promise<{
  status: string;
  message?: string;
  responseTime?: number;
}> {
  try {
    const start = Date.now();
    // TODO: Implement actual Redis health check
    // await redis.ping();
    const responseTime = Date.now() - start;

    return {
      status: "healthy",
      responseTime,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message:
        error instanceof Error ? error.message : "Redis connection failed",
    };
  }
}

async function checkStorageHealth(): Promise<{
  status: string;
  message?: string;
  responseTime?: number;
}> {
  try {
    const start = Date.now();
    // TODO: Implement actual storage health check
    // Check if storage service is accessible
    const responseTime = Date.now() - start;

    return {
      status: "healthy",
      responseTime,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message:
        error instanceof Error ? error.message : "Storage service failed",
    };
  }
}
