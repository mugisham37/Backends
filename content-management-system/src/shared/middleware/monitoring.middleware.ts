import type { NextFunction, Request, Response } from "express";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Monitoring middleware for performance tracking and health checks
 */
export function performanceMonitoring() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    await reply;

    const duration = Date.now() - startTime;
    request.log.info({ duration }, "Request completed");
  };
}

/**
 * Express-style monitoring middleware
 */
export function expressPerformanceMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      console.log(`${req.method} ${req.path} - ${duration}ms`);
    });

    next();
  };
}

/**
 * Health check monitoring
 */
export function healthCheckMiddleware() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    // Basic health check logic
    reply
      .status(200)
      .send({ status: "ok", timestamp: new Date().toISOString() });
  };
}

/**
 * Application metrics middleware
 */
export function applicationMetricsMiddleware() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/**
 * Audit logs middleware
 */
export function auditLogsMiddleware() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      logs: [],
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Metrics middleware
 */
export function metricsMiddleware() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      metrics: { cpu: 0, memory: 0 },
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * System health summary middleware
 */
export function systemHealthSummaryMiddleware() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      health: { status: "healthy", services: [] },
      timestamp: new Date().toISOString(),
    });
  };
}
