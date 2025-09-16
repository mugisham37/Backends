import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "tsyringe";
import { AuditService } from "../../modules/audit/audit.service";
import { createModuleLogger, logger } from "../utils/logger";

const monitoringLogger = createModuleLogger("monitoring");

/**
 * Enhanced monitoring middleware for Fastify
 * Tracks API metrics, performance, and system health
 */
export const monitoringMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const startTime = Date.now();
  const requestId = (request as any).requestId || crypto.randomUUID();

  // Add monitoring context to request
  (request as any).monitoring = {
    startTime,
    requestId,
  };

  // Hook into response to capture metrics
  reply.addHook("onSend", async (request: any, reply: any, payload: any) => {
    const responseTime = Date.now() - startTime;
    const user = request.user;

    try {
      const monitoringService = container.resolve(MonitoringService);

      // Record API metrics (this is now handled by audit service)
      await monitoringService.recordApiMetrics({
        path: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTime,
        userId: user?.id,
      });

      // Log slow requests
      if (responseTime > 1000) {
        monitoringLogger.warn("Slow request detected", {
          requestId,
          method: request.method,
          url: request.url,
          responseTime,
          userId: user?.id,
          statusCode: reply.statusCode,
        });
      }

      // Log error responses
      if (reply.statusCode >= 400) {
        monitoringLogger.warn("Error response", {
          requestId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime,
          userId: user?.id,
        });
      }
    } catch (error) {
      logger.error("Error in monitoring middleware:", error);
    }

    return payload;
  });
};

/**
 * Health check middleware that provides system status
 */
export const healthCheckMiddleware = async (
  _request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const monitoringService = container.resolve(MonitoringService);
    const health = await monitoringService.getHealthStatus();

    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
        ? 200
        : 503;

    return reply.status(statusCode).send({
      status: "success",
      data: health,
    });
  } catch (error) {
    monitoringLogger.error("Health check failed:", error);
    return reply.status(503).send({
      status: "error",
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Metrics endpoint middleware
 */
export const metricsMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Check if user has admin permissions
    const user = (request as any).user;
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return reply.status(403).send({
        status: "error",
        message: "Insufficient permissions to access metrics",
      });
    }

    const monitoringService = container.resolve(MonitoringService);
    const metricsResult = await monitoringService.getMetrics();

    if (!metricsResult.success) {
      return reply.status(500).send({
        status: "error",
        message: "Failed to retrieve metrics",
        error: metricsResult.error.message,
      });
    }

    return reply.status(200).send({
      status: "success",
      data: metricsResult.data,
    });
  } catch (error) {
    monitoringLogger.error("Metrics endpoint failed:", error);
    return reply.status(500).send({
      status: "error",
      message: "Metrics retrieval failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Application metrics endpoint middleware
 */
export const applicationMetricsMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Check if user has admin permissions
    const user = (request as any).user;
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return reply.status(403).send({
        status: "error",
        message: "Insufficient permissions to access application metrics",
      });
    }

    const monitoringService = container.resolve(MonitoringService);
    const metricsResult = await monitoringService.getApplicationMetrics();

    if (!metricsResult.success) {
      return reply.status(500).send({
        status: "error",
        message: "Failed to retrieve application metrics",
        error: metricsResult.error.message,
      });
    }

    return reply.status(200).send({
      status: "success",
      data: metricsResult.data,
    });
  } catch (error) {
    monitoringLogger.error("Application metrics endpoint failed:", error);
    return reply.status(500).send({
      status: "error",
      message: "Application metrics retrieval failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Audit logs endpoint middleware
 */
export const auditLogsMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Check if user has admin permissions
    const user = (request as any).user;
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return reply.status(403).send({
        status: "error",
        message: "Insufficient permissions to access audit logs",
      });
    }

    const auditService = container.resolve(AuditService);
    const query = request.query as any;

    const filter = {
      type: query.type,
      userId: query.userId,
      tenantId: query.tenantId || user.tenantId,
      severity: query.severity,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
    };

    const logsResult = await auditService.getAuditLogs(filter);

    if (!logsResult.success) {
      return reply.status(500).send({
        status: "error",
        message: "Failed to retrieve audit logs",
        error: logsResult.error.message,
      });
    }

    return reply.status(200).send({
      status: "success",
      data: {
        logs: logsResult.data,
        filter,
        count: logsResult.data.length,
      },
    });
  } catch (error) {
    monitoringLogger.error("Audit logs endpoint failed:", error);
    return reply.status(500).send({
      status: "error",
      message: "Audit logs retrieval failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * System health summary middleware for dashboard
 */
export const systemHealthSummaryMiddleware = async (
  _request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const [monitoringService, auditService] = [
      container.resolve(MonitoringService),
      container.resolve(AuditService),
    ];

    const [healthResult, metricsResult, systemHealthResult] = await Promise.all(
      [
        monitoringService.getHealthStatus(),
        auditService.getSystemMetrics(),
        auditService.getSystemHealth(),
      ]
    );

    const summary = {
      timestamp: new Date().toISOString(),
      overall: {
        status: healthResult.status,
        uptime: healthResult.uptime,
        version: healthResult.version,
        environment: healthResult.environment,
      },
      services: healthResult.services,
      performance: healthResult.performance,
      metrics: metricsResult.success ? metricsResult.data : null,
      systemHealth: systemHealthResult.success ? systemHealthResult.data : null,
    };

    return reply.status(200).send({
      status: "success",
      data: summary,
    });
  } catch (error) {
    monitoringLogger.error("System health summary failed:", error);
    return reply.status(500).send({
      status: "error",
      message: "System health summary failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
