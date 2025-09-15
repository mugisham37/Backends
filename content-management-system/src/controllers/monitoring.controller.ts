import type { FastifyRequest, FastifyReply } from "fastify";
import { container } from "tsyringe";
import { MonitoringService } from "../services/monitoring.service";
import { AuditService } from "../services/audit.service";
import { logger, createModuleLogger } from "../utils/logger";

const controllerLogger = createModuleLogger("monitoring-controller");

export class MonitoringController {
  /**
   * Get comprehensive system health status
   */
  public getHealthStatus = async (
    request: FastifyRequest,
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
      controllerLogger.error("Health status check failed:", error);
      return reply.status(500).send({
        status: "error",
        message: "Health status check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * Get detailed system metrics
   */
  public getMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if user has admin role
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
      controllerLogger.error("Metrics retrieval failed:", error);
      return reply.status(500).send({
        status: "error",
        message: "Metrics retrieval failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * Get application-specific metrics
   */
  public getApplicationMetrics = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // Check if user has admin role
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
      controllerLogger.error("Application metrics retrieval failed:", error);
      return reply.status(500).send({
        status: "error",
        message: "Application metrics retrieval failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * Simple health check endpoint for load balancers
   */
  public healthCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const monitoringService = container.resolve(MonitoringService);
      const isHealthy = await monitoringService.isHealthy();

      if (isHealthy) {
        return reply.status(200).send({
          status: "success",
          message: "Service is healthy",
          timestamp: new Date().toISOString(),
        });
      } else {
        return reply.status(503).send({
          status: "error",
          message: "Service is unhealthy",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      controllerLogger.error("Health check failed:", error);
      return reply.status(503).send({
        status: "error",
        message: "Health check failed",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * Get audit logs with filtering
   */
  public getAuditLogs = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // Check if user has admin role
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
      controllerLogger.error("Audit logs retrieval failed:", error);
      return reply.status(500).send({
        status: "error",
        message: "Audit logs retrieval failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * Get system performance metrics
   */
  public getPerformanceMetrics = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // Check if user has admin role
      const user = (request as any).user;
      if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
        return reply.status(403).send({
          status: "error",
          message: "Insufficient permissions to access performance metrics",
        });
      }

      const auditService = container.resolve(AuditService);
      const systemHealthResult = await auditService.getSystemHealth();

      if (!systemHealthResult.success) {
        return reply.status(500).send({
          status: "error",
          message: "Failed to retrieve performance metrics",
          error: systemHealthResult.error.message,
        });
      }

      return reply.status(200).send({
        status: "success",
        data: systemHealthResult.data,
      });
    } catch (error) {
      controllerLogger.error("Performance metrics retrieval failed:", error);
      return reply.status(500).send({
        status: "error",
        message: "Performance metrics retrieval failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  /**
   * Get comprehensive dashboard data
   */
  public getDashboardData = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // Check if user has admin role
      const user = (request as any).user;
      if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
        return reply.status(403).send({
          status: "error",
          message: "Insufficient permissions to access dashboard data",
        });
      }

      const [monitoringService, auditService] = [
        container.resolve(MonitoringService),
        container.resolve(AuditService),
      ];

      const [healthStatus, systemMetrics, applicationMetrics, systemHealth] =
        await Promise.all([
          monitoringService.getHealthStatus(),
          auditService.getSystemMetrics(),
          monitoringService.getApplicationMetrics(),
          auditService.getSystemHealth(),
        ]);

      const dashboardData = {
        timestamp: new Date().toISOString(),
        health: healthStatus,
        metrics: systemMetrics.success ? systemMetrics.data : null,
        application: applicationMetrics.success
          ? applicationMetrics.data
          : null,
        systemHealth: systemHealth.success ? systemHealth.data : null,
        alerts: [], // Would be populated with active alerts
        summary: {
          status: healthStatus.status,
          uptime: healthStatus.uptime.formatted,
          requestsPerMinute: systemMetrics.success
            ? systemMetrics.data.api.requestsPerMinute
            : 0,
          errorRate: systemMetrics.success
            ? systemMetrics.data.api.errorRate
            : 0,
          averageResponseTime: systemMetrics.success
            ? systemMetrics.data.averageResponseTime
            : 0,
        },
      };

      return reply.status(200).send({
        status: "success",
        data: dashboardData,
      });
    } catch (error) {
      controllerLogger.error("Dashboard data retrieval failed:", error);
      return reply.status(500).send({
        status: "error",
        message: "Dashboard data retrieval failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
