import { z } from "zod";
import {
  idParamsSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  searchQuerySchema,
  successResponseSchema,
  uuidSchema,
} from "../../shared/validators/common.schemas.js";

/**
 * Zod validation schemas for audit management endpoints
 */

// Audit action enum schema
export const auditActionSchema = z.enum([
  "create",
  "read",
  "update",
  "delete",
  "login",
  "logout",
  "upload",
  "download",
  "publish",
  "unpublish",
]);

// Audit filter schema
export const auditFilterSchema = z.object({
  action: z.array(auditActionSchema).optional(),
  resource: z.array(z.string()).optional(),
  userId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  ipAddress: z.string().ip().optional(),
});

// Audit query schema
export const auditQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    action: auditActionSchema.optional(),
    resource: z.string().optional(),
    userId: uuidSchema.optional(),
    tenantId: uuidSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    ipAddress: z.string().ip().optional(),
    sortBy: z
      .enum(["timestamp", "action", "resource", "userId"])
      .default("timestamp"),
  });

// Create audit log schema
export const createAuditLogSchema = z.object({
  action: auditActionSchema,
  resource: z
    .string()
    .min(1, "Resource is required")
    .max(255, "Resource must be less than 255 characters"),
  resourceId: z
    .string()
    .min(1, "Resource ID is required")
    .max(255, "Resource ID must be less than 255 characters"),
  userId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),
  metadata: z
    .object({
      changes: z.record(z.object({ from: z.any(), to: z.any() })).optional(),
      additionalData: z.record(z.any()).optional(),
      requestId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z
    .string()
    .max(500, "User agent must be less than 500 characters")
    .optional(),
});

// Bulk audit log creation schema
export const bulkCreateAuditLogSchema = z.object({
  logs: z
    .array(createAuditLogSchema)
    .min(1, "At least one audit log is required"),
});

// Audit configuration schema
export const auditConfigSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).default(90),
  batchSize: z.number().int().min(1).max(1000).default(100),
  enabledActions: z
    .array(auditActionSchema)
    .default(["create", "update", "delete", "login", "logout"]),
  enabledResources: z
    .array(z.string())
    .default(["content", "media", "user", "tenant", "webhook"]),
});

// Response schemas
export const auditMetadataSchema = z.object({
  changes: z.record(z.object({ from: z.any(), to: z.any() })).optional(),
  additionalData: z.record(z.any()).optional(),
  requestId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const auditLogSchema = z.object({
  id: uuidSchema,
  action: auditActionSchema,
  resource: z.string(),
  resourceId: z.string(),
  userId: uuidSchema.nullable(),
  tenantId: uuidSchema.nullable(),
  metadata: auditMetadataSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  timestamp: z.string().datetime(),
});

export const auditLogWithUserSchema = auditLogSchema.extend({
  user: z
    .object({
      id: uuidSchema,
      email: z.string(),
      firstName: z.string(),
      lastName: z.string(),
    })
    .nullable(),
});

export const auditStatsSchema = z.object({
  totalLogs: z.number(),
  actionCounts: z.record(auditActionSchema, z.number()),
  resourceCounts: z.record(z.string(), z.number()),
  dailyActivity: z.array(
    z.object({
      date: z.string().datetime(),
      count: z.number(),
    })
  ),
});

export const auditReportSchema = z.object({
  period: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }),
  summary: auditStatsSchema,
  topUsers: z.array(
    z.object({
      userId: uuidSchema,
      email: z.string(),
      actionCount: z.number(),
    })
  ),
  topResources: z.array(
    z.object({
      resource: z.string(),
      actionCount: z.number(),
    })
  ),
});

// Response schemas
export const auditLogResponseSchema = successResponseSchema(
  auditLogWithUserSchema
);
export const auditLogListResponseSchema = paginatedResponseSchema(
  auditLogWithUserSchema
);
export const auditStatsResponseSchema = successResponseSchema(auditStatsSchema);
export const auditReportResponseSchema =
  successResponseSchema(auditReportSchema);
export const auditConfigResponseSchema =
  successResponseSchema(auditConfigSchema);

// Endpoint schemas
export const getAuditLogsEndpoint = {
  body: z.void(),
  query: auditQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const getAuditLogEndpoint = {
  body: z.void(),
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const createAuditLogEndpoint = {
  body: createAuditLogSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const bulkCreateAuditLogsEndpoint = {
  body: bulkCreateAuditLogSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const getAuditStatsEndpoint = {
  body: z.void(),
  query: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    groupBy: z.enum(["day", "week", "month"]).default("day"),
  }),
  params: z.void(),
  headers: z.void(),
};

export const getAuditReportEndpoint = {
  body: z.void(),
  query: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    format: z.enum(["json", "csv", "pdf"]).default("json"),
  }),
  params: z.void(),
  headers: z.void(),
};

export const updateAuditConfigEndpoint = {
  body: auditConfigSchema.partial(),
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const cleanupAuditLogsEndpoint = {
  body: z.object({
    olderThan: z.coerce.date(),
    dryRun: z.boolean().default(false),
  }),
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

// Type exports
export type AuditAction = z.infer<typeof auditActionSchema>;
export type AuditFilter = z.infer<typeof auditFilterSchema>;
export type AuditQueryParams = z.infer<typeof auditQuerySchema>;
export type CreateAuditLogRequest = z.infer<typeof createAuditLogSchema>;
export type BulkCreateAuditLogRequest = z.infer<
  typeof bulkCreateAuditLogSchema
>;
export type AuditConfig = z.infer<typeof auditConfigSchema>;
export type AuditMetadata = z.infer<typeof auditMetadataSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditLogWithUser = z.infer<typeof auditLogWithUserSchema>;
export type AuditStats = z.infer<typeof auditStatsSchema>;
export type AuditReport = z.infer<typeof auditReportSchema>;
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;
export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
export type AuditStatsResponse = z.infer<typeof auditStatsResponseSchema>;
export type AuditReportResponse = z.infer<typeof auditReportResponseSchema>;
export type AuditConfigResponse = z.infer<typeof auditConfigResponseSchema>;
