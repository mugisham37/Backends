/**
 * Webhook GraphQL Resolvers
 * Implements GraphQL operations for webhook functionality
 */

import { WebhookService } from "../../../modules/webhook/webhook.service.js";
import { WebhookRepository } from "../../../core/repositories/webhook.repository.js";
import { AppError } from "../../../core/errors/app-error.js";
import { db } from "../../../core/database/connection.js";

// Initialize services
const webhookRepository = new WebhookRepository(db);
const webhookService = new WebhookService(webhookRepository);

export const webhookResolvers = {
  Query: {
    // Webhook Endpoints
    webhookEndpoints: async (_: any, args: any, context: any) => {
      const { filters = {}, first = 100, after } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      // Add user filtering based on role
      if (context.user?.role === "vendor") {
        filters.vendorId = context.user.id;
      } else if (context.user?.role !== "admin") {
        filters.userId = context.user?.id;
      }

      const endpoints = await webhookService.getEndpoints(
        filters,
        first,
        offset
      );

      return {
        edges: endpoints.map((endpoint: any, index: number) => ({
          node: endpoint,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: endpoints.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            endpoints.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            endpoints.length > 0
              ? Buffer.from(`${offset + endpoints.length - 1}`).toString(
                  "base64"
                )
              : null,
        },
        totalCount: endpoints.length,
      };
    },

    webhookEndpoint: async (_: any, { id }: any, context: any) => {
      const endpoint = await webhookService.getEndpointById(id);

      // Check if user has permission to view this endpoint
      if (
        context.user?.role !== "admin" &&
        endpoint.userId !== context.user?.id &&
        endpoint.vendorId !== context.user?.id
      ) {
        throw new AppError(
          "Insufficient permissions",
          403,
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      return endpoint;
    },

    // Webhook Events
    webhookEvents: async (_: any, args: any, context: any) => {
      const { filters = {}, first = 100, after } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      // Add user filtering based on role
      if (context.user?.role === "vendor") {
        filters.vendorId = context.user.id;
      } else if (context.user?.role !== "admin") {
        filters.userId = context.user?.id;
      }

      const events = await webhookService.getEvents(filters, first, offset);

      return {
        edges: events.map((event: any, index: number) => ({
          node: event,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: events.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            events.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            events.length > 0
              ? Buffer.from(`${offset + events.length - 1}`).toString("base64")
              : null,
        },
        totalCount: events.length,
      };
    },

    // Webhook Deliveries
    webhookDeliveries: async (_: any, args: any, context: any) => {
      const { filters = {}, first = 100, after } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      const deliveries = await webhookService.getDeliveries(
        filters,
        first,
        offset
      );

      return {
        edges: deliveries.map((delivery: any, index: number) => ({
          node: delivery,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: deliveries.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            deliveries.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            deliveries.length > 0
              ? Buffer.from(`${offset + deliveries.length - 1}`).toString(
                  "base64"
                )
              : null,
        },
        totalCount: deliveries.length,
      };
    },

    // Webhook Statistics
    webhookStats: async (_: any, args: any, context: any) => {
      // Only admins can view overall webhook stats
      if (context.user?.role !== "admin") {
        throw new AppError("Admin permissions required", 403, "ADMIN_ONLY");
      }

      return await webhookService.getWebhookStats();
    },

    // Endpoint-specific queries
    endpointLogs: async (
      _: any,
      { webhookEndpointId, first = 100, after }: any,
      context: any
    ) => {
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      // Verify user has access to this endpoint
      if (context.user?.role !== "admin") {
        const endpoint = await webhookService.getEndpointById(
          webhookEndpointId
        );
        if (
          endpoint.userId !== context.user?.id &&
          endpoint.vendorId !== context.user?.id
        ) {
          throw new AppError(
            "Insufficient permissions",
            403,
            "INSUFFICIENT_PERMISSIONS"
          );
        }
      }

      const logs = await webhookService.getEndpointLogs(
        webhookEndpointId,
        first,
        offset
      );

      return {
        edges: logs.map((log: any, index: number) => ({
          node: log,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: logs.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            logs.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            logs.length > 0
              ? Buffer.from(`${offset + logs.length - 1}`).toString("base64")
              : null,
        },
        totalCount: logs.length,
      };
    },
  },

  Mutation: {
    // Webhook Endpoint Management
    createWebhookEndpoint: async (_: any, { input }: any, context: any) => {
      // Add user context to the webhook
      const webhookData = {
        ...input,
        userId: context.user?.id,
        vendorId:
          context.user?.role === "vendor" ? context.user.id : input.vendorId,
      };

      return await webhookService.createEndpoint(webhookData);
    },

    updateWebhookEndpoint: async (_: any, { id, input }: any, context: any) => {
      // Verify ownership before updating
      const existingEndpoint = await webhookService.getEndpointById(id);
      if (
        context.user?.role !== "admin" &&
        existingEndpoint.userId !== context.user?.id &&
        existingEndpoint.vendorId !== context.user?.id
      ) {
        throw new AppError(
          "Insufficient permissions",
          403,
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      return await webhookService.updateEndpoint(id, input);
    },

    deleteWebhookEndpoint: async (_: any, { id }: any, context: any) => {
      // Verify ownership before deleting
      const existingEndpoint = await webhookService.getEndpointById(id);
      if (
        context.user?.role !== "admin" &&
        existingEndpoint.userId !== context.user?.id &&
        existingEndpoint.vendorId !== context.user?.id
      ) {
        throw new AppError(
          "Insufficient permissions",
          403,
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      await webhookService.deleteEndpoint(id);
      return true;
    },

    // Webhook Event Management
    dispatchWebhookEvent: async (_: any, { input }: any) => {
      return await webhookService.dispatchEvent(input);
    },

    // Webhook Delivery Management
    retryWebhookDelivery: async (_: any, { deliveryId }: any) => {
      return await webhookService.retryDelivery(deliveryId);
    },

    // Testing and Utilities
    testWebhookEndpoint: async (_: any, { id }: any, context: any) => {
      // Verify ownership before testing
      const existingEndpoint = await webhookService.getEndpointById(id);
      if (
        context.user?.role !== "admin" &&
        existingEndpoint.userId !== context.user?.id &&
        existingEndpoint.vendorId !== context.user?.id
      ) {
        throw new AppError(
          "Insufficient permissions",
          403,
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      return await webhookService.testEndpoint(id);
    },

    cleanupWebhookData: async (
      _: any,
      { retentionDays }: any,
      context: any
    ) => {
      // Verify admin permissions
      if (context.user?.role !== "admin") {
        throw new AppError("Admin permissions required", 403, "ADMIN_ONLY");
      }

      return await webhookService.cleanupOldData(retentionDays || 90);
    },
  },

  // Type resolvers
  WebhookEndpoint: {
    id: (parent: any) => parent.id,
    url: (parent: any) => parent.url,
    eventTypes: (parent: any) => parent.eventTypes,
    isActive: (parent: any) => parent.isActive,
    secret: (parent: any) => parent.secret,
    headers: (parent: any) => parent.headers,
    timeoutMs: (parent: any) => parent.timeoutMs,
    retryCount: (parent: any) => parent.retryCount,
    status: (parent: any) => parent.status,
    userId: (parent: any) => parent.userId,
    vendorId: (parent: any) => parent.vendorId,
    lastDeliveryAt: (parent: any) => parent.lastDeliveryAt,
    failureCount: (parent: any) => parent.failureCount,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },

  WebhookEvent: {
    id: (parent: any) => parent.id,
    eventType: (parent: any) => parent.eventType,
    sourceType: (parent: any) => parent.sourceType,
    sourceId: (parent: any) => parent.sourceId,
    eventData: (parent: any) => parent.eventData,
    userId: (parent: any) => parent.userId,
    vendorId: (parent: any) => parent.vendorId,
    isProcessed: (parent: any) => parent.isProcessed,
    processedAt: (parent: any) => parent.processedAt,
    metadata: (parent: any) => parent.metadata,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },

  WebhookDelivery: {
    id: (parent: any) => parent.id,
    webhookEndpointId: (parent: any) => parent.webhookEndpointId,
    webhookEventId: (parent: any) => parent.webhookEventId,
    deliveryStatus: (parent: any) => parent.deliveryStatus,
    httpStatusCode: (parent: any) => parent.httpStatusCode,
    responseBody: (parent: any) => parent.responseBody,
    responseHeaders: (parent: any) => parent.responseHeaders,
    requestHeaders: (parent: any) => parent.requestHeaders,
    requestBody: (parent: any) => parent.requestBody,
    attemptCount: (parent: any) => parent.attemptCount,
    lastAttemptAt: (parent: any) => parent.lastAttemptAt,
    nextRetryAt: (parent: any) => parent.nextRetryAt,
    deliveredAt: (parent: any) => parent.deliveredAt,
    failedAt: (parent: any) => parent.failedAt,
    errorMessage: (parent: any) => parent.errorMessage,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },

  WebhookLog: {
    id: (parent: any) => parent.id,
    webhookEndpointId: (parent: any) => parent.webhookEndpointId,
    logLevel: (parent: any) => parent.logLevel,
    message: (parent: any) => parent.message,
    eventData: (parent: any) => parent.eventData,
    metadata: (parent: any) => parent.metadata,
    createdAt: (parent: any) => parent.createdAt,
  },
};
