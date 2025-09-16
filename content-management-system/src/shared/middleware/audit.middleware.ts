import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "tsyringe";
import { AuditService } from "../../modules/audit/audit.service";
import { logger } from "../utils/logger";

/**
 * Enhanced audit middleware for Fastify with comprehensive logging
 */
export const auditMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Add request ID to request context
  (request as any).requestId = requestId;

  // Get audit service
  const auditService = container.resolve(AuditService);

  // Get user information from request context
  const user = (request as any).user;
  const userId = user?.id;
  const tenantId = user?.tenantId;
  const sessionId = (request as any).sessionId;

  // Get request information
  const ip = request.ip;
  const userAgent = request.headers["user-agent"];
  const method = request.method;
  const url = request.url;

  // Log request start
  request.log.info("Request started", {
    requestId,
    method,
    url,
    userId,
    tenantId,
    ip,
    userAgent,
  } as any);

  // Hook into response to log completion
  reply.addHook("onSend", async (request: any, reply: any, payload: any) => {
    const responseTime = Date.now() - startTime;
    const statusCode = reply.statusCode;

    // Log API request to audit service
    await auditService.logApiRequest({
      method,
      url,
      statusCode,
      responseTime,
      userId,
      tenantId,
      sessionId,
      ip,
      userAgent: userAgent || undefined,
      requestId,
      requestSize: request.headers["content-length"]
        ? parseInt(request.headers["content-length"] as string, 10)
        : undefined,
      responseSize: typeof payload === "string" ? payload.length : undefined,
    });

    // Log request completion
    request.log.info("Request completed", {
      requestId,
      method,
      url,
      statusCode,
      responseTime,
      userId,
      tenantId,
    });

    return payload;
  });
};

/**
 * Create specific audit middleware for different operations
 */
export const createAuditMiddleware = (options: {
  action: string;
  resource: string;
  getEntityId?: (request: FastifyRequest) => string;
  severity?: "low" | "medium" | "high" | "critical";
}) => {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const auditService = container.resolve(AuditService);
      const user = (request as any).user;

      // Get entity ID if provided
      const entityId = options.getEntityId
        ? options.getEntityId(request)
        : undefined;

      // Log user action
      if (user?.id) {
        await auditService.logUserAction({
          userId: user.id,
          tenantId: user.tenantId,
          action: options.action,
          resource: options.resource,
          details: {
            method: request.method,
            url: request.url,
            entityId,
            params: request.params,
            query: request.query,
            body: request.body,
          },
          ip: request.ip,
          userAgent: request.headers["user-agent"] || undefined,
        });
      }
    } catch (error) {
      // Don't block the request if audit logging fails
      logger.warn("Audit logging failed:", error);
    }
  };
};

/**
 * Pre-configured audit middleware for common operations
 */
export const contentAudit = {
  create: createAuditMiddleware({
    action: "create",
    resource: "content",
    getEntityId: (req) => (req.body as any)?.title || "unknown",
    severity: "low",
  }),
  update: createAuditMiddleware({
    action: "update",
    resource: "content",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "low",
  }),
  delete: createAuditMiddleware({
    action: "delete",
    resource: "content",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "medium",
  }),
  publish: createAuditMiddleware({
    action: "publish",
    resource: "content",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "medium",
  }),
  unpublish: createAuditMiddleware({
    action: "unpublish",
    resource: "content",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "medium",
  }),
};

export const userAudit = {
  create: createAuditMiddleware({
    action: "create",
    resource: "user",
    getEntityId: (req) => (req.body as any)?.email,
    severity: "medium",
  }),
  update: createAuditMiddleware({
    action: "update",
    resource: "user",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "medium",
  }),
  delete: createAuditMiddleware({
    action: "delete",
    resource: "user",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "high",
  }),
  changeRole: createAuditMiddleware({
    action: "change_role",
    resource: "user",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "high",
  }),
};

export const mediaAudit = {
  upload: createAuditMiddleware({
    action: "upload",
    resource: "media",
    getEntityId: (req) => (req.body as any)?.filename || "unknown",
    severity: "low",
  }),
  update: createAuditMiddleware({
    action: "update",
    resource: "media",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "low",
  }),
  delete: createAuditMiddleware({
    action: "delete",
    resource: "media",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "medium",
  }),
};

export const authAudit = {
  login: createAuditMiddleware({
    action: "login",
    resource: "auth",
    getEntityId: (req) => (req.body as any)?.email,
    severity: "medium",
  }),
  logout: createAuditMiddleware({
    action: "logout",
    resource: "auth",
    getEntityId: (req) => (req as any).user?.id || "unknown",
    severity: "low",
  }),
  refreshToken: createAuditMiddleware({
    action: "refresh_token",
    resource: "auth",
    getEntityId: (req) => (req as any).user?.id || "unknown",
    severity: "low",
  }),
};

export const webhookAudit = {
  create: createAuditMiddleware({
    action: "create",
    resource: "webhook",
    getEntityId: (req) => (req.body as any)?.name,
    severity: "medium",
  }),
  update: createAuditMiddleware({
    action: "update",
    resource: "webhook",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "medium",
  }),
  delete: createAuditMiddleware({
    action: "delete",
    resource: "webhook",
    getEntityId: (req) => (req.params as any)?.id,
    severity: "high",
  }),
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const startTime = Date.now();
  const operation = `${request.method} ${request.url}`;

  reply.addHook("onSend", async () => {
    const duration = Date.now() - startTime;

    try {
      const auditService = container.resolve(AuditService);
      const user = (request as any).user;

      await auditService.logPerformanceMetrics({
        operation,
        duration,
        userId: user?.id,
        tenantId: user?.tenantId,
        metadata: {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
        },
      });
    } catch (error) {
      logger.warn("Performance logging failed:", error);
    }
  });
};

/**
 * Error tracking middleware
 */
export const errorTrackingMiddleware = async (
  error: Error,
  request: FastifyRequest,
  _reply: FastifyReply
) => {
  try {
    const auditService = container.resolve(AuditService);
    const user = (request as any).user;

    // Determine error severity
    let severity: "low" | "medium" | "high" | "critical" = "medium";
    if (error.name === "ValidationError") severity = "low";
    if (error.name === "DatabaseError") severity = "high";
    if (error.name === "SecurityError") severity = "critical";

    await auditService.logSystemError({
      error,
      userId: user?.id,
      tenantId: user?.tenantId,
      severity,
      context: {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        headers: request.headers,
        requestId: (request as any).requestId,
      },
    });
  } catch (auditError) {
    logger.error("Error tracking failed:", auditError);
  }

  // Continue with normal error handling
  throw error;
};
