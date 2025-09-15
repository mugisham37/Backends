import type { FastifyInstance } from "fastify";
import {
  healthCheckMiddleware,
  metricsMiddleware,
  applicationMetricsMiddleware,
  auditLogsMiddleware,
  systemHealthSummaryMiddleware,
} from "../../../middleware/monitoring.middleware";

/**
 * Health and monitoring routes
 * Provides endpoints for system health checks, metrics, and monitoring
 */
export async function healthRoutes(fastify: FastifyInstance) {
  // Simple health check for load balancers
  fastify.get(
    "/health",
    {
      schema: {
        description: "Simple health check endpoint",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              timestamp: { type: "string" },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              timestamp: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    healthCheckMiddleware
  );

  // Detailed health status
  fastify.get(
    "/health/status",
    {
      schema: {
        description: "Comprehensive system health status",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { MonitoringController } = await import(
        "../../../controllers/monitoring.controller"
      );
      const controller = new MonitoringController();
      return controller.getHealthStatus(request, reply);
    }
  );

  // System metrics (admin only)
  fastify.get(
    "/health/metrics",
    {
      schema: {
        description: "System metrics and performance data",
        tags: ["Health", "Admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: { type: "object" },
            },
          },
          403: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: [fastify.authenticate], // Assuming auth middleware exists
    },
    metricsMiddleware
  );

  // Application metrics (admin only)
  fastify.get(
    "/health/metrics/application",
    {
      schema: {
        description: "Application-specific metrics",
        tags: ["Health", "Admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    applicationMetricsMiddleware
  );

  // Audit logs (admin only)
  fastify.get(
    "/health/audit",
    {
      schema: {
        description: "System audit logs",
        tags: ["Health", "Admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            type: { type: "string" },
            userId: { type: "string" },
            tenantId: { type: "string" },
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            limit: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: {
                type: "object",
                properties: {
                  logs: { type: "array" },
                  filter: { type: "object" },
                  count: { type: "integer" },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    auditLogsMiddleware
  );

  // System health summary for dashboard
  fastify.get(
    "/health/summary",
    {
      schema: {
        description: "System health summary for dashboard",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    systemHealthSummaryMiddleware
  );

  // Performance metrics (admin only)
  fastify.get(
    "/health/performance",
    {
      schema: {
        description: "System performance metrics",
        tags: ["Health", "Admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { MonitoringController } = await import(
        "../../../controllers/monitoring.controller"
      );
      const controller = new MonitoringController();
      return controller.getPerformanceMetrics(request, reply);
    }
  );

  // Dashboard data (admin only)
  fastify.get(
    "/health/dashboard",
    {
      schema: {
        description: "Comprehensive dashboard data",
        tags: ["Health", "Admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { MonitoringController } = await import(
        "../../../controllers/monitoring.controller"
      );
      const controller = new MonitoringController();
      return controller.getDashboardData(request, reply);
    }
  );
}
