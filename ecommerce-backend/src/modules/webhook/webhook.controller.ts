/**
 * Webhook Controller
 * Handles webhook endpoint management and event delivery endpoints
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  WebhookService,
  type CreateWebhookEndpointInput,
  type UpdateWebhookEndpointInput,
  type CreateWebhookEventInput,
} from "./webhook.service.js";
import { AppError } from "../../core/errors/app-error.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../shared/utils/response.utils.js";
import type { AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";

export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(
    request: FastifyRequest<{ Body: CreateWebhookEndpointInput }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Add user context to the webhook
    const webhookData = {
      ...request.body,
      userId: request.userId,
      vendorId:
        request.user?.role === "vendor"
          ? request.userId
          : request.body.vendorId,
    };

    const endpoint = await this.webhookService.createEndpoint(webhookData);

    reply
      .status(HTTP_STATUS.CREATED)
      .send(
        ResponseBuilder.success(endpoint, { requestId: (request as any).id })
      );
  }

  /**
   * Get webhook endpoints
   */
  async getEndpoints(
    request: FastifyRequest<{
      Querystring: {
        status?: string;
        eventTypes?: string;
        isActive?: boolean;
        limit?: number;
        offset?: number;
      };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const {
      status,
      eventTypes,
      isActive,
      limit = 100,
      offset = 0,
    } = request.query;

    const filters: any = {};

    // Add user/vendor filtering based on role
    if (request.user?.role === "vendor") {
      filters.vendorId = request.userId;
    } else if (request.user?.role !== "admin") {
      filters.userId = request.userId;
    }

    if (status) filters.status = status;
    if (isActive !== undefined) filters.isActive = isActive;
    if (eventTypes) {
      filters.eventTypes = eventTypes.split(",");
    }

    const endpoints = await this.webhookService.getEndpoints(
      filters,
      limit,
      offset
    );

    reply.send(
      ResponseBuilder.success(
        { endpoints, count: endpoints.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get webhook endpoint by ID
   */
  async getEndpointById(
    request: FastifyRequest<{
      Params: { id: string };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    const endpoint = await this.webhookService.getEndpointById(id);

    // Check if user has permission to view this endpoint
    if (
      request.user?.role !== "admin" &&
      endpoint.userId !== request.userId &&
      endpoint.vendorId !== request.userId
    ) {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    reply.send(
      ResponseBuilder.success(endpoint, { requestId: (request as any).id })
    );
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    request: FastifyRequest<{
      Params: { id: string };
      Body: UpdateWebhookEndpointInput;
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    // Verify ownership before updating
    const existingEndpoint = await this.webhookService.getEndpointById(id);
    if (
      request.user?.role !== "admin" &&
      existingEndpoint.userId !== request.userId &&
      existingEndpoint.vendorId !== request.userId
    ) {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    const updated = await this.webhookService.updateEndpoint(id, request.body);

    reply.send(
      ResponseBuilder.success(updated, { requestId: (request as any).id })
    );
  }

  /**
   * Delete webhook endpoint
   */
  async deleteEndpoint(
    request: FastifyRequest<{
      Params: { id: string };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    // Verify ownership before deleting
    const existingEndpoint = await this.webhookService.getEndpointById(id);
    if (
      request.user?.role !== "admin" &&
      existingEndpoint.userId !== request.userId &&
      existingEndpoint.vendorId !== request.userId
    ) {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    await this.webhookService.deleteEndpoint(id);

    reply.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Dispatch webhook event (typically called by other services)
   */
  async dispatchEvent(
    request: FastifyRequest<{ Body: CreateWebhookEventInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const event = await this.webhookService.dispatchEvent(request.body);

    reply
      .status(HTTP_STATUS.CREATED)
      .send(ResponseBuilder.success(event, { requestId: (request as any).id }));
  }

  /**
   * Get webhook events
   */
  async getEvents(
    request: FastifyRequest<{
      Querystring: {
        eventType?: string;
        sourceType?: string;
        isProcessed?: boolean;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const {
      eventType,
      sourceType,
      isProcessed,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = request.query;

    const filters: any = {};

    // Add user/vendor filtering based on role
    if (request.user?.role === "vendor") {
      filters.vendorId = request.userId;
    } else if (request.user?.role !== "admin") {
      filters.userId = request.userId;
    }

    if (eventType) filters.eventType = eventType;
    if (sourceType) filters.sourceType = sourceType;
    if (isProcessed !== undefined) filters.isProcessed = isProcessed;

    if (startDate && endDate) {
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
    }

    const events = await this.webhookService.getEvents(filters, limit, offset);

    reply.send(
      ResponseBuilder.success(
        { events, count: events.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(
    request: FastifyRequest<{
      Querystring: {
        webhookEndpointId?: string;
        deliveryStatus?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const {
      webhookEndpointId,
      deliveryStatus,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = request.query;

    const filters: any = {};

    if (webhookEndpointId) {
      // Verify user has access to this endpoint
      if (request.user?.role !== "admin") {
        const endpoint = await this.webhookService.getEndpointById(
          webhookEndpointId
        );
        if (
          endpoint.userId !== request.userId &&
          endpoint.vendorId !== request.userId
        ) {
          throw new AppError(
            "Insufficient permissions",
            403,
            "INSUFFICIENT_PERMISSIONS"
          );
        }
      }
      filters.webhookEndpointId = webhookEndpointId;
    }

    if (deliveryStatus) filters.deliveryStatus = deliveryStatus;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
    }

    const deliveries = await this.webhookService.getDeliveries(
      filters,
      limit,
      offset
    );

    reply.send(
      ResponseBuilder.success(
        { deliveries, count: deliveries.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Retry failed webhook delivery
   */
  async retryDelivery(
    request: FastifyRequest<{
      Params: { deliveryId: string };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { deliveryId } = request.params;

    // Note: In a real implementation, you might want to check ownership of the delivery
    // For now, we'll allow any authenticated user to retry deliveries

    const delivery = await this.webhookService.retryDelivery(deliveryId);

    reply.send(
      ResponseBuilder.success(delivery, { requestId: (request as any).id })
    );
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(
    request: FastifyRequest<{
      Params: { id: string };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    // Verify ownership before testing
    const existingEndpoint = await this.webhookService.getEndpointById(id);
    if (
      request.user?.role !== "admin" &&
      existingEndpoint.userId !== request.userId &&
      existingEndpoint.vendorId !== request.userId
    ) {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    const result = await this.webhookService.testEndpoint(id);

    reply.send(
      ResponseBuilder.success(result, { requestId: (request as any).id })
    );
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(
    request: FastifyRequest & AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Only admins can view overall webhook stats
    if (request.user?.role !== "admin") {
      throw new AppError("Admin permissions required", 403, "ADMIN_ONLY");
    }

    const stats = await this.webhookService.getWebhookStats();

    reply.send(
      ResponseBuilder.success(stats, { requestId: (request as any).id })
    );
  }

  /**
   * Get logs for a webhook endpoint
   */
  async getEndpointLogs(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { limit?: number; offset?: number };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;
    const { limit = 100, offset = 0 } = request.query;

    // Verify ownership before viewing logs
    const existingEndpoint = await this.webhookService.getEndpointById(id);
    if (
      request.user?.role !== "admin" &&
      existingEndpoint.userId !== request.userId &&
      existingEndpoint.vendorId !== request.userId
    ) {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    const logs = await this.webhookService.getEndpointLogs(id, limit, offset);

    reply.send(
      ResponseBuilder.success(
        { logs, count: logs.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Clean up old webhook data (admin only)
   */
  async cleanupOldData(
    request: FastifyRequest<{
      Body: { retentionDays?: number };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Verify admin permissions
    if (request.user?.role !== "admin") {
      throw new AppError("Admin permissions required", 403, "ADMIN_ONLY");
    }

    const { retentionDays = 90 } = request.body;

    const result = await this.webhookService.cleanupOldData(retentionDays);

    reply.send(
      ResponseBuilder.success(result, { requestId: (request as any).id })
    );
  }
}
