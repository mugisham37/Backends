import { z } from "zod";
import {
  idParamsSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  searchQuerySchema,
  successResponseSchema,
  urlValidation,
  uuidSchema,
} from "./common.schemas.js";

/**
 * Zod validation schemas for webhook management endpoints
 */

// Webhook creation schema
export const createWebhookSchema = z.object({
  name: z
    .string()
    .min(1, "Webhook name is required")
    .max(255, "Name must be less than 255 characters"),
  url: urlValidation,
  events: z.array(z.string()).min(1, "At least one event must be specified"),
  secret: z
    .string()
    .min(8, "Secret must be at least 8 characters long")
    .optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().min(1).max(30).default(10), // seconds
  retryAttempts: z.number().int().min(0).max(5).default(3),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Webhook update schema
export const updateWebhookSchema = z.object({
  name: z
    .string()
    .min(1, "Webhook name is required")
    .max(255, "Name must be less than 255 characters")
    .optional(),
  url: urlValidation.optional(),
  events: z
    .array(z.string())
    .min(1, "At least one event must be specified")
    .optional(),
  secret: z
    .string()
    .min(8, "Secret must be at least 8 characters long")
    .optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().min(1).max(30).optional(),
  retryAttempts: z.number().int().min(0).max(5).optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Webhook query schema
export const webhookQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    isActive: z.coerce.boolean().optional(),
    event: z.string().optional(),
    sortBy: z
      .enum(["name", "createdAt", "updatedAt", "lastTriggeredAt"])
      .default("createdAt"),
  });

// Webhook delivery query schema
export const webhookDeliveryQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "success", "failed", "retrying"]).optional(),
  event: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "deliveredAt", "status"]).default("createdAt"),
});

// Webhook test schema
export const testWebhookSchema = z.object({
  event: z.string().min(1, "Event type is required"),
  payload: z.record(z.any()).optional(),
});

// Response schemas
export const webhookSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  secret: z.string().nullable(),
  headers: z.record(z.string()),
  timeout: z.number(),
  retryAttempts: z.number(),
  isActive: z.boolean(),
  description: z.string().nullable(),
  metadata: z.record(z.any()),
  lastTriggeredAt: z.string().datetime().nullable(),
  successCount: z.number(),
  failureCount: z.number(),
  tenantId: uuidSchema,
  createdBy: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const webhookDeliverySchema = z.object({
  id: uuidSchema,
  webhookId: uuidSchema,
  event: z.string(),
  payload: z.record(z.any()),
  status: z.enum(["pending", "success", "failed", "retrying"]),
  httpStatus: z.number().nullable(),
  response: z.string().nullable(),
  error: z.string().nullable(),
  attempts: z.number(),
  nextRetryAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const webhookStatsSchema = z.object({
  totalWebhooks: z.number(),
  activeWebhooks: z.number(),
  totalDeliveries: z.number(),
  successfulDeliveries: z.number(),
  failedDeliveries: z.number(),
  averageResponseTime: z.number(),
  deliveriesByEvent: z.record(z.number()),
  deliveriesByStatus: z.record(z.number()),
});

export const webhookEventSchema = z.object({
  event: z.string(),
  description: z.string(),
  payloadSchema: z.record(z.any()),
});

export const webhookResponseSchema = successResponseSchema(webhookSchema);
export const webhookListResponseSchema = paginatedResponseSchema(webhookSchema);
export const webhookDeliveryResponseSchema = successResponseSchema(
  webhookDeliverySchema
);
export const webhookDeliveryListResponseSchema = paginatedResponseSchema(
  webhookDeliverySchema
);
export const webhookStatsResponseSchema =
  successResponseSchema(webhookStatsSchema);
export const webhookEventsResponseSchema = successResponseSchema(
  z.array(webhookEventSchema)
);

// Endpoint schemas
export const createWebhookEndpoint = {
  body: createWebhookSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateWebhookEndpoint = {
  body: updateWebhookSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const getWebhookEndpoint = {
  body: z.void(),
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const listWebhooksEndpoint = {
  body: z.void(),
  query: webhookQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const testWebhookEndpoint = {
  body: testWebhookSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const getWebhookDeliveriesEndpoint = {
  body: z.void(),
  query: webhookDeliveryQuerySchema,
  params: idParamsSchema,
  headers: z.void(),
};

// Type exports
export type CreateWebhookRequest = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookRequest = z.infer<typeof updateWebhookSchema>;
export type WebhookQueryParams = z.infer<typeof webhookQuerySchema>;
export type WebhookDeliveryQueryParams = z.infer<
  typeof webhookDeliveryQuerySchema
>;
export type TestWebhookRequest = z.infer<typeof testWebhookSchema>;
export type Webhook = z.infer<typeof webhookSchema>;
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;
export type WebhookStats = z.infer<typeof webhookStatsSchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
export type WebhookListResponse = z.infer<typeof webhookListResponseSchema>;
export type WebhookDeliveryResponse = z.infer<
  typeof webhookDeliveryResponseSchema
>;
export type WebhookDeliveryListResponse = z.infer<
  typeof webhookDeliveryListResponseSchema
>;
export type WebhookStatsResponse = z.infer<typeof webhookStatsResponseSchema>;
export type WebhookEventsResponse = z.infer<typeof webhookEventsResponseSchema>;
