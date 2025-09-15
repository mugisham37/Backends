import type { Request, Response, NextFunction } from "express"
import { auditService } from "../services/audit.service"

/**
 * Create audit middleware
 */
export const createAuditMiddleware = (options: {
  action: string
  entityType: string
  getEntityId: (req: Request) => string
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get entity ID
      const entityId = options.getEntityId(req)

      // Get user information
      const user = (req as any).user
      const userId = user?._id?.toString()
      const userEmail = user?.email

      // Get request information
      const ipAddress = req.ip
      const userAgent = req.headers["user-agent"]

      // Create audit log
      await auditService.log({
        action: options.action,
        entityType: options.entityType,
        entityId,
        userId,
        userEmail,
        ipAddress,
        userAgent,
        details: {
          method: req.method,
          path: req.path,
          body: req.body,
          params: req.params,
          query: req.query,
        },
      })

      next()
    } catch (error) {
      // Don't block the request if audit logging fails
      console.error("Audit logging failed:", error)
      next()
    }
  }
}

/**
 * Audit middleware for content operations
 */
export const contentAudit = {
  create: createAuditMiddleware({
    action: "content.create",
    entityType: "content",
    getEntityId: (req) => req.body.contentTypeId,
  }),
  update: createAuditMiddleware({
    action: "content.update",
    entityType: "content",
    getEntityId: (req) => req.params.id,
  }),
  delete: createAuditMiddleware({
    action: "content.delete",
    entityType: "content",
    getEntityId: (req) => req.params.id,
  }),
  publish: createAuditMiddleware({
    action: "content.publish",
    entityType: "content",
    getEntityId: (req) => req.params.id,
  }),
  unpublish: createAuditMiddleware({
    action: "content.unpublish",
    entityType: "content",
    getEntityId: (req) => req.params.id,
  }),
  archive: createAuditMiddleware({
    action: "content.archive",
    entityType: "content",
    getEntityId: (req) => req.params.id,
  }),
}

/**
 * Audit middleware for content type operations
 */
export const contentTypeAudit = {
  create: createAuditMiddleware({
    action: "contentType.create",
    entityType: "contentType",
    getEntityId: (req) => req.body.name,
  }),
  update: createAuditMiddleware({
    action: "contentType.update",
    entityType: "contentType",
    getEntityId: (req) => req.params.id,
  }),
  delete: createAuditMiddleware({
    action: "contentType.delete",
    entityType: "contentType",
    getEntityId: (req) => req.params.id,
  }),
}

/**
 * Audit middleware for user operations
 */
export const userAudit = {
  create: createAuditMiddleware({
    action: "user.create",
    entityType: "user",
    getEntityId: (req) => req.body.email,
  }),
  update: createAuditMiddleware({
    action: "user.update",
    entityType: "user",
    getEntityId: (req) => req.params.id,
  }),
  delete: createAuditMiddleware({
    action: "user.delete",
    entityType: "user",
    getEntityId: (req) => req.params.id,
  }),
  changeRole: createAuditMiddleware({
    action: "user.changeRole",
    entityType: "user",
    getEntityId: (req) => req.params.id,
  }),
  changePassword: createAuditMiddleware({
    action: "user.changePassword",
    entityType: "user",
    getEntityId: (req) => req.params.id || (req as any).user?._id?.toString(),
  }),
}

/**
 * Audit middleware for media operations
 */
export const mediaAudit = {
  upload: createAuditMiddleware({
    action: "media.upload",
    entityType: "media",
    getEntityId: (req) => req.body.filename || "unknown",
  }),
  update: createAuditMiddleware({
    action: "media.update",
    entityType: "media",
    getEntityId: (req) => req.params.id,
  }),
  delete: createAuditMiddleware({
    action: "media.delete",
    entityType: "media",
    getEntityId: (req) => req.params.id,
  }),
}

/**
 * Audit middleware for webhook operations
 */
export const webhookAudit = {
  create: createAuditMiddleware({
    action: "webhook.create",
    entityType: "webhook",
    getEntityId: (req) => req.body.name,
  }),
  update: createAuditMiddleware({
    action: "webhook.update",
    entityType: "webhook",
    getEntityId: (req) => req.params.id,
  }),
  delete: createAuditMiddleware({
    action: "webhook.delete",
    entityType: "webhook",
    getEntityId: (req) => req.params.id,
  }),
}

/**
 * Audit middleware for workflow operations
 */
export const workflowAudit = {
  create: createAuditMiddleware({
    action: "workflow.create",
    entityType: "workflow",
    getEntityId: (req) => req.body.name,
  }),
  update: createAuditMiddleware({
    action: "workflow.update",
    entityType: "workflow",
    getEntityId: (req) => req.params.id,
  }),
  delete: createAuditMiddleware({
    action: "workflow.delete",
    entityType: "workflow",
    getEntityId: (req) => req.params.id,
  }),
  transition: createAuditMiddleware({
    action: "workflow.transition",
    entityType: "workflow",
    getEntityId: (req) => req.params.id,
  }),
}

/**
 * Audit middleware for authentication operations
 */
export const authAudit = {
  login: createAuditMiddleware({
    action: "auth.login",
    entityType: "user",
    getEntityId: (req) => req.body.email,
  }),
  logout: createAuditMiddleware({
    action: "auth.logout",
    entityType: "user",
    getEntityId: (req) => (req as any).user?._id?.toString() || "unknown",
  }),
  refreshToken: createAuditMiddleware({
    action: "auth.refreshToken",
    entityType: "user",
    getEntityId: (req) => (req as any).user?._id?.toString() || "unknown",
  }),
  resetPassword: createAuditMiddleware({
    action: "auth.resetPassword",
    entityType: "user",
    getEntityId: (req) => req.body.email || "unknown",
  }),
}
