/**
 * Webhook Service
 * Handles webhook endpoint management, event dispatch, and delivery tracking
 */

import {
  WebhookRepository,
  type WebhookEndpointFilters,
  type WebhookEventFilters,
  type WebhookDeliveryFilters,
  type WebhookStats,
} from "../../core/repositories/webhook.repository.js";
import {
  type WebhookEndpoint,
  type NewWebhookEndpoint,
  type WebhookEvent,
  type NewWebhookEvent,
  type WebhookDelivery,
  type NewWebhookDelivery,
  type WebhookSubscription,
  type NewWebhookSubscription,
  type WebhookLog,
  type NewWebhookLog,
} from "../../core/database/schema/webhooks.js";
import { AppError } from "../../core/errors/app-error.js";
import crypto from "crypto";

export interface CreateWebhookEndpointInput {
  name: string;
  description?: string;
  url: string;
  httpMethod?: string;
  secret?: string;
  contentType?: string;
  maxRetries?: number;
  timeoutSeconds?: number;
  eventTypes: string[];
  filters?: Record<string, any>;
  headers?: Record<string, string>;
  authType?: string;
  authCredentials?: Record<string, string>;
  userId?: string;
  vendorId?: string;
}

export interface UpdateWebhookEndpointInput {
  name?: string;
  description?: string;
  url?: string;
  httpMethod?: string;
  secret?: string;
  contentType?: string;
  maxRetries?: number;
  timeoutSeconds?: number;
  eventTypes?: string[];
  filters?: Record<string, any>;
  headers?: Record<string, string>;
  authType?: string;
  authCredentials?: Record<string, string>;
  status?: string;
  isActive?: boolean;
}

export interface CreateWebhookEventInput {
  eventType: string;
  eventId: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
  sourceId?: string;
  sourceType?: string;
  userId?: string;
  vendorId?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseTime: number;
  error?: string;
}

export class WebhookService {
  constructor(private readonly webhookRepository: WebhookRepository) {}

  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(
    input: CreateWebhookEndpointInput
  ): Promise<WebhookEndpoint> {
    try {
      // Validate URL format
      this.validateUrl(input.url);

      // Generate secret if not provided
      const secret = input.secret || this.generateSecret();

      const endpointData: NewWebhookEndpoint = {
        name: input.name,
        description: input.description,
        url: input.url,
        httpMethod: (input.httpMethod as any) || "POST",
        secret,
        contentType: input.contentType || "application/json",
        maxRetries: input.maxRetries || 3,
        timeoutSeconds: input.timeoutSeconds || 30,
        eventTypes: input.eventTypes,
        filters: input.filters,
        headers: input.headers,
        authType: input.authType,
        authCredentials: input.authCredentials
          ? this.encryptCredentials(input.authCredentials)
          : undefined,
        userId: input.userId,
        vendorId: input.vendorId,
      };

      return await this.webhookRepository.createEndpoint(endpointData);
    } catch (error) {
      throw new AppError(
        "Failed to create webhook endpoint",
        500,
        "WEBHOOK_CREATION_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Get webhook endpoints with filters
   */
  async getEndpoints(
    filters: WebhookEndpointFilters = {},
    limit = 100,
    offset = 0
  ): Promise<WebhookEndpoint[]> {
    return await this.webhookRepository.getEndpoints(filters, limit, offset);
  }

  /**
   * Get webhook endpoint by ID
   */
  async getEndpointById(id: string): Promise<WebhookEndpoint> {
    const endpoint = await this.webhookRepository.getEndpointById(id);
    if (!endpoint) {
      throw new AppError(
        "Webhook endpoint not found",
        404,
        "WEBHOOK_NOT_FOUND"
      );
    }
    return endpoint;
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    id: string,
    input: UpdateWebhookEndpointInput
  ): Promise<WebhookEndpoint> {
    try {
      // Validate URL if provided
      if (input.url) {
        this.validateUrl(input.url);
      }

      const updateData: Partial<NewWebhookEndpoint> = {};

      // Copy primitive fields
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.secret !== undefined) updateData.secret = input.secret;
      if (input.contentType !== undefined)
        updateData.contentType = input.contentType;
      if (input.maxRetries !== undefined)
        updateData.maxRetries = input.maxRetries;
      if (input.timeoutSeconds !== undefined)
        updateData.timeoutSeconds = input.timeoutSeconds;
      if (input.eventTypes !== undefined)
        updateData.eventTypes = input.eventTypes;
      if (input.filters !== undefined) updateData.filters = input.filters;
      if (input.headers !== undefined) updateData.headers = input.headers;
      if (input.authType !== undefined) updateData.authType = input.authType;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      // Handle enum fields
      if (input.httpMethod !== undefined) {
        updateData.httpMethod = input.httpMethod as any;
      }
      if (input.status !== undefined) {
        updateData.status = input.status as any;
      }

      // Encrypt auth credentials if provided
      if (input.authCredentials) {
        updateData.authCredentials = this.encryptCredentials(
          input.authCredentials
        );
      }

      const updated = await this.webhookRepository.updateEndpoint(
        id,
        updateData
      );
      if (!updated) {
        throw new AppError(
          "Webhook endpoint not found",
          404,
          "WEBHOOK_NOT_FOUND"
        );
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Failed to update webhook endpoint",
        500,
        "WEBHOOK_UPDATE_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Delete webhook endpoint
   */
  async deleteEndpoint(id: string): Promise<void> {
    const deleted = await this.webhookRepository.deleteEndpoint(id);
    if (!deleted) {
      throw new AppError(
        "Webhook endpoint not found",
        404,
        "WEBHOOK_NOT_FOUND"
      );
    }
  }

  /**
   * Create and dispatch a webhook event
   */
  async dispatchEvent(input: CreateWebhookEventInput): Promise<WebhookEvent> {
    try {
      // Create the event
      const eventData: NewWebhookEvent = {
        eventType: input.eventType as any,
        eventId: input.eventId,
        payload: input.payload,
        metadata: input.metadata,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        userId: input.userId,
        vendorId: input.vendorId,
      };

      const event = await this.webhookRepository.createEvent(eventData);

      // Find matching endpoints for this event type
      const endpoints = await this.webhookRepository.getEndpointsByEventType(
        input.eventType
      );

      // Schedule deliveries for each matching endpoint
      await Promise.all(
        endpoints.map(async (endpoint) => {
          if (this.shouldDeliverToEndpoint(endpoint, event)) {
            await this.scheduleDelivery(endpoint, event);
          }
        })
      );

      // Mark event as processed
      await this.webhookRepository.markEventAsProcessed(event.id);

      return event;
    } catch (error) {
      throw new AppError(
        "Failed to dispatch webhook event",
        500,
        "WEBHOOK_DISPATCH_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Get webhook events with filters
   */
  async getEvents(
    filters: WebhookEventFilters = {},
    limit = 100,
    offset = 0
  ): Promise<WebhookEvent[]> {
    return await this.webhookRepository.getEvents(filters, limit, offset);
  }

  /**
   * Get webhook deliveries with filters
   */
  async getDeliveries(
    filters: WebhookDeliveryFilters = {},
    limit = 100,
    offset = 0
  ): Promise<WebhookDelivery[]> {
    return await this.webhookRepository.getDeliveries(filters, limit, offset);
  }

  /**
   * Retry failed webhook delivery
   */
  async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.webhookRepository.getDeliveryById(deliveryId);
    if (!delivery) {
      throw new AppError(
        "Webhook delivery not found",
        404,
        "DELIVERY_NOT_FOUND"
      );
    }

    const endpoint = await this.webhookRepository.getEndpointById(
      delivery.webhookEndpointId
    );
    if (!endpoint) {
      throw new AppError(
        "Webhook endpoint not found",
        404,
        "WEBHOOK_NOT_FOUND"
      );
    }

    const event = await this.webhookRepository.getEventById(
      delivery.webhookEventId
    );
    if (!event) {
      throw new AppError("Webhook event not found", 404, "EVENT_NOT_FOUND");
    }

    // Attempt delivery
    const result = await this.performDelivery(endpoint, event);

    // Update delivery record
    const updateData: Partial<NewWebhookDelivery> = {
      attemptNumber: delivery.attemptNumber + 1,
      deliveryStatus: result.success ? "success" : "failed",
      responseStatus: result.statusCode,
      responseBody: result.responseBody,
      responseTime: result.responseTime,
      errorMessage: result.error,
      deliveredAt: result.success ? new Date() : undefined,
      nextRetryAt:
        !result.success && delivery.attemptNumber < (endpoint.maxRetries || 3)
          ? this.calculateNextRetry(delivery.attemptNumber + 1)
          : undefined,
    };

    const updated = await this.webhookRepository.updateDelivery(
      deliveryId,
      updateData
    );
    if (!updated) {
      throw new AppError(
        "Failed to update delivery",
        500,
        "DELIVERY_UPDATE_ERROR"
      );
    }

    // Update endpoint statistics
    await this.webhookRepository.updateEndpointStats(
      endpoint.id,
      result.success,
      new Date()
    );

    return updated;
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(): Promise<WebhookStats> {
    return await this.webhookRepository.getWebhookStats();
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(id: string): Promise<WebhookDeliveryResult> {
    const endpoint = await this.getEndpointById(id);

    // Create a test event
    const testEvent: WebhookEvent = {
      id: "test",
      eventType: "system.test" as any,
      eventId: `test-${Date.now()}`,
      payload: {
        message: "This is a test webhook",
        timestamp: new Date().toISOString(),
      },
      metadata: {
        test: true,
      },
      sourceId: "system",
      sourceType: "test",
      userId: null,
      vendorId: null,
      isProcessed: false,
      processedAt: null,
      createdAt: new Date(),
    };

    return await this.performDelivery(endpoint, testEvent);
  }

  /**
   * Get logs for a webhook endpoint
   */
  async getEndpointLogs(
    endpointId: string,
    limit = 100,
    offset = 0
  ): Promise<WebhookLog[]> {
    return await this.webhookRepository.getLogsByEndpoint(
      endpointId,
      limit,
      offset
    );
  }

  /**
   * Clean up old webhook data
   */
  async cleanupOldData(retentionDays = 90): Promise<{
    deletedEvents: number;
    deletedDeliveries: number;
    deletedLogs: number;
  }> {
    try {
      const [deletedEvents, deletedDeliveries, deletedLogs] = await Promise.all(
        [
          this.webhookRepository.deleteOldEvents(retentionDays),
          this.webhookRepository.deleteOldDeliveries(retentionDays),
          this.webhookRepository.deleteOldLogs(retentionDays),
        ]
      );

      return {
        deletedEvents,
        deletedDeliveries,
        deletedLogs,
      };
    } catch (error) {
      throw new AppError(
        "Failed to cleanup old webhook data",
        500,
        "CLEANUP_ERROR",
        { originalError: error }
      );
    }
  }

  // Private helper methods

  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch (error) {
      throw new AppError("Invalid webhook URL", 400, "INVALID_URL");
    }
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private encryptCredentials(
    credentials: Record<string, string>
  ): Record<string, string> {
    // In a real implementation, encrypt these credentials
    // For now, we'll just return them as-is with a warning
    console.warn(
      "WARNING: Webhook credentials should be encrypted in production"
    );
    return credentials;
  }

  private shouldDeliverToEndpoint(
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): boolean {
    // Check if endpoint is active
    if (!endpoint.isActive || endpoint.status !== "active") {
      return false;
    }

    // Check if endpoint subscribes to this event type
    if (!endpoint.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Apply any additional filters
    if (endpoint.filters) {
      // Implement filter logic based on your requirements
      // For now, we'll assume all events pass through
    }

    return true;
  }

  private async scheduleDelivery(
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<void> {
    const deliveryData: NewWebhookDelivery = {
      webhookEndpointId: endpoint.id,
      webhookEventId: event.id,
      requestUrl: endpoint.url,
      requestMethod: endpoint.httpMethod,
      requestHeaders: this.buildRequestHeaders(endpoint, event),
      requestBody: JSON.stringify(event.payload),
      deliveryStatus: "pending",
      attemptNumber: 1,
      scheduledAt: new Date(),
    };

    const delivery = await this.webhookRepository.createDelivery(deliveryData);

    // Attempt immediate delivery
    const result = await this.performDelivery(endpoint, event);

    // Update delivery with result
    const updateData: Partial<NewWebhookDelivery> = {
      deliveryStatus: result.success ? "success" : "failed",
      responseStatus: result.statusCode,
      responseBody: result.responseBody,
      responseTime: result.responseTime,
      errorMessage: result.error,
      deliveredAt: result.success ? new Date() : undefined,
      nextRetryAt:
        !result.success && delivery.attemptNumber < (endpoint.maxRetries || 3)
          ? this.calculateNextRetry(1)
          : undefined,
    };

    await this.webhookRepository.updateDelivery(delivery.id, updateData);

    // Update endpoint statistics
    await this.webhookRepository.updateEndpointStats(
      endpoint.id,
      result.success,
      new Date()
    );
  }

  private buildRequestHeaders(
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": endpoint.contentType || "application/json",
      "User-Agent": "Ecommerce-Webhook/1.0",
      "X-Webhook-Event": event.eventType,
      "X-Webhook-Event-ID": event.eventId,
      "X-Webhook-Timestamp": new Date().toISOString(),
    };

    // Add webhook signature
    if (endpoint.secret) {
      const signature = this.generateSignature(
        JSON.stringify(event.payload),
        endpoint.secret
      );
      headers["X-Webhook-Signature"] = signature;
    }

    // Add custom headers
    if (endpoint.headers) {
      Object.assign(headers, endpoint.headers);
    }

    // Add authentication headers
    if (endpoint.authType && endpoint.authCredentials) {
      const authHeaders = this.buildAuthHeaders(
        endpoint.authType,
        endpoint.authCredentials
      );
      Object.assign(headers, authHeaders);
    }

    return headers;
  }

  private generateSignature(payload: string, secret: string): string {
    return `sha256=${crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")}`;
  }

  private buildAuthHeaders(
    authType: string,
    credentials: Record<string, string>
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (authType) {
      case "bearer":
        if (credentials.token) {
          headers["Authorization"] = `Bearer ${credentials.token}`;
        }
        break;
      case "basic":
        if (credentials.username && credentials.password) {
          const encoded = Buffer.from(
            `${credentials.username}:${credentials.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${encoded}`;
        }
        break;
      case "api_key":
        if (credentials.key && credentials.header) {
          headers[credentials.header] = credentials.key;
        }
        break;
    }

    return headers;
  }

  private async performDelivery(
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      const headers = this.buildRequestHeaders(endpoint, event);
      const payload = JSON.stringify(event.payload);

      // In a real implementation, use a proper HTTP client like axios or fetch
      // For now, we'll simulate the delivery
      const response = await this.simulateHttpRequest(endpoint.url, {
        method: endpoint.httpMethod,
        headers,
        body: payload,
        timeout: (endpoint.timeoutSeconds || 30) * 1000,
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        responseBody: response.body,
        responseTime,
        error: response.status >= 400 ? `HTTP ${response.status}` : undefined,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async simulateHttpRequest(
    url: string,
    options: any
  ): Promise<{
    status: number;
    body: string;
  }> {
    // Simulate HTTP request - in production, use a real HTTP client
    // This is just for demonstration
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 200,
          body: JSON.stringify({ received: true }),
        });
      }, Math.random() * 1000); // Random delay up to 1 second
    });
  }

  private calculateNextRetry(attemptNumber: number): Date {
    // Exponential backoff: 2^attempt minutes
    const delayMinutes = Math.pow(2, attemptNumber);
    const nextRetry = new Date();
    nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
    return nextRetry;
  }
}
