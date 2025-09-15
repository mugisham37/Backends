import crypto from "crypto"
import { WebhookRepository, WebhookDeliveryRepository } from "../db/repositories/webhook.repository"
import { type WebhookEvent, WebhookStatus } from "../db/models/webhook.model"
import { logger } from "../utils/logger"
import { ApiError } from "../utils/errors"

export class WebhookService {
  private webhookRepository: WebhookRepository
  private webhookDeliveryRepository: WebhookDeliveryRepository

  constructor() {
    this.webhookRepository = new WebhookRepository()
    this.webhookDeliveryRepository = new WebhookDeliveryRepository()
  }

  /**
   * Get all webhooks
   */
  async getAllWebhooks(
    filter: {
      search?: string
      event?: WebhookEvent
      status?: WebhookStatus
      contentTypeId?: string
    } = {},
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    webhooks: any[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.search) {
      const regex = new RegExp(filter.search, "i")
      filterQuery.$or = [{ name: regex }, { url: regex }]
    }

    if (filter.event) {
      filterQuery.events = filter.event
    }

    if (filter.status) {
      filterQuery.status = filter.status
    }

    if (filter.contentTypeId) {
      filterQuery.$or = [{ contentTypeIds: filter.contentTypeId }, { contentTypeIds: { $exists: false } }]
    }

    // Get paginated results
    const result = await this.webhookRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: { createdAt: -1 },
    })

    return {
      webhooks: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string): Promise<any> {
    return this.webhookRepository.findByIdOrThrow(id)
  }

  /**
   * Create webhook
   */
  async createWebhook(data: {
    name: string
    url: string
    secret?: string
    events: WebhookEvent[]
    contentTypeIds?: string[]
    status?: WebhookStatus
  }): Promise<any> {
    // Validate URL
    this.validateUrl(data.url)

    // Create webhook
    return this.webhookRepository.create({
      name: data.name,
      url: data.url,
      secret: data.secret,
      events: data.events,
      contentTypeIds: data.contentTypeIds,
      status: data.status || WebhookStatus.ACTIVE,
    })
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    id: string,
    data: {
      name?: string
      url?: string
      secret?: string
      events?: WebhookEvent[]
      contentTypeIds?: string[]
      status?: WebhookStatus
    },
  ): Promise<any> {
    // Validate URL if provided
    if (data.url) {
      this.validateUrl(data.url)
    }

    // Update webhook
    return this.webhookRepository.updateByIdOrThrow(id, data)
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string): Promise<void> {
    await this.webhookRepository.deleteByIdOrThrow(id)
  }

  /**
   * Get webhook deliveries
   */
  async getWebhookDeliveries(webhookId: string, limit = 10): Promise<any[]> {
    return this.webhookDeliveryRepository.findByWebhook(webhookId, limit)
  }

  /**
   * Test webhook
   */
  async testWebhook(id: string): Promise<any> {
    const webhook = await this.webhookRepository.findByIdOrThrow(id)

    // Create test payload
    const payload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook delivery",
      },
    }

    // Send webhook
    return this.sendWebhook(webhook, payload)
  }

  /**
   * Retry webhook delivery
   */
  async retryWebhookDelivery(deliveryId: string): Promise<any> {
    // Get delivery
    const delivery = await this.webhookDeliveryRepository.findByIdOrThrow(deliveryId)

    // Get webhook
    const webhook = await this.webhookRepository.findByIdOrThrow(delivery.webhook.toString())

    // Parse request data
    const requestData = JSON.parse(delivery.request)

    // Send webhook
    return this.sendWebhook(webhook, requestData.body)
  }

  /**
   * Trigger webhook for event
   */
  async triggerWebhook(
    event: WebhookEvent,
    data: any,
    contentTypeId?: string,
  ): Promise<{ success: number; failed: number }> {
    // Find webhooks for this event
    let webhooks
    if (contentTypeId) {
      webhooks = await this.webhookRepository.findByEventAndContentType(event, contentTypeId)
    } else {
      webhooks = await this.webhookRepository.findByEvent(event)
    }

    if (webhooks.length === 0) {
      return { success: 0, failed: 0 }
    }

    // Create payload
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    }

    // Send webhooks
    const results = await Promise.all(webhooks.map((webhook) => this.sendWebhook(webhook, payload)))

    // Count successes and failures
    const success = results.filter((result) => result.success).length
    const failed = results.length - success

    return { success, failed }
  }

  /**
   * Send webhook
   */
  private async sendWebhook(webhook: any, payload: any): Promise<any> {
    const { url, secret } = webhook

    // Prepare request
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "CMS-API-Webhook",
    }

    // Add signature if secret is provided
    if (secret) {
      const signature = this.generateSignature(body, secret)
      headers["X-Webhook-Signature"] = signature
    }

    // Log request
    const requestLog = {
      url,
      headers,
      body: payload,
    }

    try {
      // Send request
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      })

      // Get response data
      const responseText = await response.text()
      const success = response.ok

      // Create delivery record
      const delivery = await this.webhookDeliveryRepository.createDelivery(
        webhook._id.toString(),
        success,
        JSON.stringify(requestLog),
        responseText,
        response.status,
      )

      return delivery
    } catch (error: any) {
      // Log error
      logger.error(`Webhook delivery failed: ${error.message}`, {
        webhookId: webhook._id.toString(),
        url,
        error,
      })

      // Create delivery record with error
      const delivery = await this.webhookDeliveryRepository.createDelivery(
        webhook._id.toString(),
        false,
        JSON.stringify(requestLog),
        undefined,
        undefined,
        error.message,
      )

      return delivery
    }
  }

  /**
   * Generate signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex")
  }

  /**
   * Validate URL
   */
  private validateUrl(url: string): void {
    try {
      new URL(url)
    } catch (error) {
      throw ApiError.badRequest("Invalid URL")
    }
  }
}
