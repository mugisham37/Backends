import type { FastifyRequest, FastifyReply } from "fastify";
import { MonitoringController } from "../controllers/monitoring.controller";

/**
 * Monitoring middleware functions for health checks and metrics
 */

const monitoringController = new MonitoringController();

/**
 * Simple health check middleware
 */
export async function healthCheckMiddleware(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    reply.status(200).send({
      status: "ok",
      message: "Service is healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    reply.status(503).send({
      status: "error",
      message: "Service unavailable",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Application metrics middleware
 */
export async function applicationMetricsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return monitoringController.getMetrics(request, reply);
}

/**
 * Audit logs middleware
 */
export async function auditLogsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return monitoringController.getLogs(request, reply);
}

/**
 * General metrics middleware
 */
export async function metricsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return monitoringController.getMetrics(request, reply);
}

/**
 * System health summary middleware
 */
export async function systemHealthSummaryMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return monitoringController.getHealth(request, reply);
}
