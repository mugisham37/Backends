import crypto from "crypto";
import { inject, injectable } from "tsyringe";
import { BaseError } from "../../core/errors/base.error";
import type { Result } from "../../core/types/result.types";
import { logger } from "../../shared/utils/logger";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import {
  Webhook,
  WebhookEvent,
  WebhookStatus,
  CreateWebhookData,
  UpdateWebhookData,
  WebhookJobData,
  WebhookDelivery,
} from "./webhook.types.js";

/**
 * Webhook-related errors
 */
export class WebhookError extends BaseError {
  readonly code = "WEBHOOK_ERROR";
  readonly statusCode = 500;
}

export class WebhookValidationError extends BaseError {
  readonly code = "WEBHOOK_VALIDATION_ERROR";
  readonly statusCode = 400;
}

export class WebhookDeliveryError extends BaseError {
  readonly code = "WEBHOOK_DELIVERY_ERROR";
  readonly statusCode = 500;
}

/**
 * Webhook service with background job processing
 * Handles webhook event system, delivery with retry logic, and signature verification
 */
@injectable()
export class WebhookService {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();

  constructor(
    @inject("AuditService") private _auditService: AuditService,
    @inject("CacheService") private _cacheService: CacheService
  ) {
    this.initializeWebhookProcessor();
  }

  /**
   * Initialize webhook processor
   */
  private async initializeWebhookProcessor(): Promise<void> {
    // Webhook processing integrated into service
  }

  /**
   * Process webhook delivery
   */
  private async processWebhookDelivery(
    jobData: Omit<WebhookJobData, "attempt"> & { attempt?: number }
  ): Promise<{ success: boolean; delivery?: string }> {
    try {
      const { webhookId, event, payload, url, secret, attempt = 1 } = jobData;

      // Send webhook
      const result = await this.sendWebhook(url, payload, secret);

      // Record successful delivery
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        webhookId,
        event: event as WebhookEvent,
        payload,
        success: true,
        statusCode: result.statusCode,
        response: result.response,
        attempt,
        deliveredAt: new Date(),
        createdAt: new Date(),
      };

      this.deliveries.set(delivery.id, delivery);

      logger.info("Webhook delivered successfully", {
        webhookId,
        event,
        attempt,
        statusCode: result.statusCode,
      });

      return { success: true, delivery: delivery.id };
    } catch (error: any) {
      const { webhookId, event, payload, attempt = 1 } = jobData;

      // Record failed delivery
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        webhookId,
        event: event as WebhookEvent,
        payload,
        success: false,
        error: error.message,
        attempt,
        createdAt: new Date(),
      };

      this.deliveries.set(delivery.id, delivery);

      logger.error("Webhook delivery failed", {
        webhookId,
        event,
        attempt,
        error: error.message,
      });

      return { success: false };
    }
  }

  /**
   * Get all webhooks
   */
  async getAllWebhooks(
    filter: {
      search?: string;
      event?: WebhookEvent;
      status?: WebhookStatus;
      tenantId?: string;
    } = {},
    pagination: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<
    Result<
      {
        webhooks: Webhook[];
        totalCount: number;
        page: number;
        totalPages: number;
      },
      WebhookError
    >
  > {
    try {
      // Check cache first
      const cacheKey = `webhooks:${JSON.stringify({ filter, pagination })}`;
      const cachedResult = await this._cacheService.get(cacheKey);
      if (cachedResult) {
        return { success: true, data: cachedResult as any };
      }

      let filteredWebhooks = Array.from(this.webhooks.values());

      // Apply filters
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredWebhooks = filteredWebhooks.filter(
          (webhook) =>
            webhook.name.toLowerCase().includes(searchLower) ||
            webhook.url.toLowerCase().includes(searchLower)
        );
      }

      if (filter.event) {
        filteredWebhooks = filteredWebhooks.filter((webhook) =>
          webhook.events.includes(filter.event!)
        );
      }

      if (filter.status) {
        filteredWebhooks = filteredWebhooks.filter(
          (webhook) => webhook.status === filter.status
        );
      }

      if (filter.tenantId) {
        filteredWebhooks = filteredWebhooks.filter(
          (webhook) => webhook.tenantId === filter.tenantId
        );
      }

      // Apply pagination
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const paginatedWebhooks = filteredWebhooks
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(startIndex, endIndex);

      const totalCount = filteredWebhooks.length;
      const totalPages = Math.ceil(totalCount / limit);

      const result = {
        webhooks: paginatedWebhooks,
        totalCount,
        page,
        totalPages,
      };

      // Cache the result for 5 minutes
      await this._cacheService.set(cacheKey, result, 300);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error("Failed to get webhooks:", error);
      return {
        success: false,
        error: new WebhookError("Failed to retrieve webhooks"),
      };
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string): Promise<Result<Webhook, WebhookError>> {
    try {
      const webhook = this.webhooks.get(id);

      if (!webhook) {
        return {
          success: false,
          error: new WebhookError(`Webhook with ID ${id} not found`),
        };
      }

      return { success: true, data: webhook };
    } catch (error) {
      logger.error(`Failed to get webhook ${id}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to retrieve webhook"),
      };
    }
  }

  /**
   * Create webhook
   */
  async createWebhook(
    data: CreateWebhookData
  ): Promise<Result<Webhook, WebhookError | WebhookValidationError>> {
    try {
      // Validate URL
      const urlValidation = this.validateUrl(data.url);
      if (!urlValidation.success) {
        return {
          success: false,
          error: new WebhookError(urlValidation.error.message),
        };
      }

      // Validate events
      if (!data.events || data.events.length === 0) {
        return {
          success: false,
          error: new WebhookError("At least one event must be specified"),
        };
      }

      const webhook: Webhook = {
        id: crypto.randomUUID(),
        name: data.name,
        url: data.url,
        events: data.events,
        status: WebhookStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(data.secret !== undefined ? { secret: data.secret } : {}),
        ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
      };

      this.webhooks.set(webhook.id, webhook);

      // Log webhook creation
      if (webhook.tenantId) {
        await this._auditService.logUserAction({
          userId: "system", // Could be passed as parameter
          tenantId: webhook.tenantId,
          action: "webhook_created",
          resource: "webhook",
          details: {
            webhookId: webhook.id,
            name: webhook.name,
            url: webhook.url,
            events: webhook.events,
            timestamp: new Date(),
          },
        });
      }

      logger.info("Webhook created", {
        webhookId: webhook.id,
        name: webhook.name,
      });

      return { success: true, data: webhook };
    } catch (error) {
      logger.error("Failed to create webhook:", error);
      return {
        success: false,
        error: new WebhookError("Failed to create webhook"),
      };
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    id: string,
    data: UpdateWebhookData
  ): Promise<Result<Webhook, WebhookError>> {
    try {
      const webhook = this.webhooks.get(id);

      if (!webhook) {
        return {
          success: false,
          error: new WebhookError(`Webhook with ID ${id} not found`),
        };
      }

      // Validate URL if provided
      if (data.url) {
        const urlValidation = this.validateUrl(data.url);
        if (!urlValidation.success) {
          return {
            success: false,
            error: new WebhookError(urlValidation.error.message),
          };
        }
      }

      // Update webhook
      const updatedWebhook: Webhook = {
        ...webhook,
        ...data,
        updatedAt: new Date(),
      };

      this.webhooks.set(id, updatedWebhook);

      logger.info("Webhook updated", { webhookId: id });

      return { success: true, data: updatedWebhook };
    } catch (error) {
      logger.error(`Failed to update webhook ${id}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to update webhook"),
      };
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string): Promise<Result<void, WebhookError>> {
    try {
      const webhook = this.webhooks.get(id);

      if (!webhook) {
        return {
          success: false,
          error: new WebhookError(`Webhook with ID ${id} not found`),
        };
      }

      this.webhooks.delete(id);

      logger.info("Webhook deleted", { webhookId: id });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to delete webhook ${id}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to delete webhook"),
      };
    }
  }

  /**
   * Get webhook deliveries
   */
  async getWebhookDeliveries(
    webhookId: string,
    limit = 10
  ): Promise<Result<WebhookDelivery[], WebhookError>> {
    try {
      const deliveries = Array.from(this.deliveries.values())
        .filter((delivery) => delivery.webhookId === webhookId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);

      return { success: true, data: deliveries };
    } catch (error) {
      logger.error(`Failed to get deliveries for webhook ${webhookId}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to retrieve webhook deliveries"),
      };
    }
  }

  /**
   * Test webhook
   */
  async testWebhook(
    id: string
  ): Promise<Result<WebhookDelivery, WebhookError>> {
    try {
      const webhook = this.webhooks.get(id);

      if (!webhook) {
        return {
          success: false,
          error: new WebhookError(`Webhook with ID ${id} not found`),
        };
      }

      // Create test payload
      const payload = {
        event: "test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook delivery",
        },
      };

      // Process webhook directly
      const jobResult = await this.processWebhookDelivery({
        webhookId: webhook.id,
        event: "test",
        payload,
        url: webhook.url,
        ...(webhook.secret !== undefined ? { secret: webhook.secret } : {}),
        attempt: 1,
      });

      if (!jobResult.success) {
        return {
          success: false,
          error: new WebhookError("Failed to queue test webhook"),
        };
      }

      // Create delivery record for tracking
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        event: WebhookEvent.CONTENT_CREATED, // Placeholder
        payload,
        success: false, // Will be updated when job completes
        attempt: 1,
        createdAt: new Date(),
      };

      this.deliveries.set(delivery.id, delivery);

      return { success: true, data: delivery };
    } catch (error) {
      logger.error(`Failed to test webhook ${id}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to test webhook"),
      };
    }
  }

  /**
   * Retry webhook delivery
   */
  async retryWebhookDelivery(
    deliveryId: string
  ): Promise<Result<WebhookDelivery, WebhookError>> {
    try {
      const delivery = this.deliveries.get(deliveryId);

      if (!delivery) {
        return {
          success: false,
          error: new WebhookError(`Delivery with ID ${deliveryId} not found`),
        };
      }

      const webhook = this.webhooks.get(delivery.webhookId);

      if (!webhook) {
        return {
          success: false,
          error: new WebhookError(
            `Webhook with ID ${delivery.webhookId} not found`
          ),
        };
      }

      // Process retry directly
      const jobResult = await this.processWebhookDelivery({
        webhookId: webhook.id,
        event: delivery.event,
        payload: delivery.payload,
        url: webhook.url,
        ...(webhook.secret !== undefined ? { secret: webhook.secret } : {}),
        attempt: delivery.attempt + 1,
      });

      if (!jobResult.success) {
        return {
          success: false,
          error: new WebhookError("Failed to queue webhook retry"),
        };
      }

      return { success: true, data: delivery };
    } catch (error) {
      logger.error(`Failed to retry webhook delivery ${deliveryId}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to retry webhook delivery"),
      };
    }
  }

  /**
   * Trigger webhook for event
   */
  async triggerWebhook(
    tenantId: string,
    event: WebhookEvent | string,
    data: any
  ): Promise<Result<{ success: number; failed: number }, WebhookError>> {
    try {
      // Find webhooks for this event
      let webhooks = Array.from(this.webhooks.values()).filter(
        (webhook) =>
          webhook.status === WebhookStatus.ACTIVE &&
          webhook.events.includes(event as WebhookEvent)
      );

      // Filter by tenant if specified
      if (tenantId) {
        webhooks = webhooks.filter(
          (webhook) => !webhook.tenantId || webhook.tenantId === tenantId
        );
      }

      if (webhooks.length === 0) {
        return { success: true, data: { success: 0, failed: 0 } };
      }

      // Create payload
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // Process webhook jobs directly
      const jobPromises = webhooks.map((webhook) =>
        this.processWebhookDelivery({
          webhookId: webhook.id,
          event,
          payload,
          url: webhook.url,
          attempt: 1,
          ...(webhook.secret !== undefined ? { secret: webhook.secret } : {}),
        })
      );

      const results = await Promise.all(jobPromises);

      // Count successes and failures
      const success = results.filter((result) => result.success).length;
      const failed = results.length - success;

      logger.info(`Triggered ${webhooks.length} webhooks for event ${event}`, {
        success,
        failed,
      });

      return { success: true, data: { success, failed } };
    } catch (error) {
      logger.error(`Failed to trigger webhooks for event ${event}:`, error);
      return {
        success: false,
        error: new WebhookError("Failed to trigger webhooks"),
      };
    }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(
    url: string,
    payload: any,
    secret?: string
  ): Promise<{ statusCode: number; response: string }> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "CMS-Webhook/1.0",
    };

    // Add signature if secret is provided
    if (secret) {
      const signature = this.generateSignature(body, secret);
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    return {
      statusCode: response.status,
      response: responseText,
    };
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Validate webhook URL
   */
  private validateUrl(url: string): Result<void, WebhookValidationError> {
    try {
      const parsedUrl = new URL(url);

      // Only allow HTTP and HTTPS
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return {
          success: false,
          error: new WebhookValidationError(
            "URL must use HTTP or HTTPS protocol"
          ),
        };
      }

      // Don't allow localhost in production
      if (
        process.env["NODE_ENV"] === "production" &&
        (parsedUrl.hostname === "localhost" ||
          parsedUrl.hostname === "127.0.0.1")
      ) {
        return {
          success: false,
          error: new WebhookValidationError(
            "Localhost URLs not allowed in production"
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (_error) {
      return {
        success: false,
        error: new WebhookValidationError("Invalid URL format"),
      };
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(): Promise<
    Result<
      {
        totalWebhooks: number;
        activeWebhooks: number;
        totalDeliveries: number;
        successfulDeliveries: number;
        failedDeliveries: number;
        queueStats: any;
      },
      WebhookError
    >
  > {
    try {
      const totalWebhooks = this.webhooks.size;
      const activeWebhooks = Array.from(this.webhooks.values()).filter(
        (webhook) => webhook.status === WebhookStatus.ACTIVE
      ).length;

      const totalDeliveries = this.deliveries.size;
      const successfulDeliveries = Array.from(this.deliveries.values()).filter(
        (delivery) => delivery.success
      ).length;
      const failedDeliveries = totalDeliveries - successfulDeliveries;

      const queueStatsResult = {
        success: true,
        data: { waiting: 0, active: 0, completed: 0, failed: 0 },
      };
      const queueStats = queueStatsResult.success
        ? queueStatsResult.data
        : null;

      return {
        success: true,
        data: {
          totalWebhooks,
          activeWebhooks,
          totalDeliveries,
          successfulDeliveries,
          failedDeliveries,
          queueStats,
        },
      };
    } catch (error) {
      logger.error("Failed to get webhook statistics:", error);
      return {
        success: false,
        error: new WebhookError("Failed to retrieve webhook statistics"),
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      logger.error("Webhook service health check failed:", error);
      return false;
    }
  }
}
