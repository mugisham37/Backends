import { BaseRepository } from "./base.repository"
import {
  WebhookModel,
  WebhookDeliveryModel,
  type IWebhook,
  type IWebhookDelivery,
  type WebhookEvent,
  WebhookStatus,
} from "../models/webhook.model"

export class WebhookRepository extends BaseRepository<IWebhook> {
  constructor() {
    super(WebhookModel)
  }

  /**
   * Find webhooks by event
   */
  async findByEvent(event: WebhookEvent): Promise<IWebhook[]> {
    return this.find({
      events: event,
      status: WebhookStatus.ACTIVE,
    })
  }

  /**
   * Find webhooks by content type
   */
  async findByContentType(contentTypeId: string): Promise<IWebhook[]> {
    return this.find({
      $or: [{ contentTypeIds: contentTypeId }, { contentTypeIds: { $exists: false } }],
      status: WebhookStatus.ACTIVE,
    })
  }

  /**
   * Find webhooks by event and content type
   */
  async findByEventAndContentType(event: WebhookEvent, contentTypeId: string): Promise<IWebhook[]> {
    return this.find({
      events: event,
      $or: [{ contentTypeIds: contentTypeId }, { contentTypeIds: { $exists: false } }],
      status: WebhookStatus.ACTIVE,
    })
  }

  /**
   * Find active webhooks
   */
  async findActive(): Promise<IWebhook[]> {
    return this.find({ status: WebhookStatus.ACTIVE })
  }

  /**
   * Find inactive webhooks
   */
  async findInactive(): Promise<IWebhook[]> {
    return this.find({ status: WebhookStatus.INACTIVE })
  }

  /**
   * Activate a webhook
   */
  async activate(webhookId: string): Promise<IWebhook> {
    return this.updateByIdOrThrow(webhookId, { status: WebhookStatus.ACTIVE })
  }

  /**
   * Deactivate a webhook
   */
  async deactivate(webhookId: string): Promise<IWebhook> {
    return this.updateByIdOrThrow(webhookId, { status: WebhookStatus.INACTIVE })
  }

  /**
   * Add events to a webhook
   */
  async addEvents(webhookId: string, events: WebhookEvent[]): Promise<IWebhook> {
    const webhook = await this.findByIdOrThrow(webhookId)

    // Add new events (avoid duplicates)
    const currentEvents = webhook.events
    const uniqueEvents = [...new Set([...currentEvents, ...events])]

    return this.updateById(webhookId, { events: uniqueEvents }) as Promise<IWebhook>
  }

  /**
   * Remove events from a webhook
   */
  async removeEvents(webhookId: string, events: WebhookEvent[]): Promise<IWebhook> {
    const webhook = await this.findByIdOrThrow(webhookId)

    // Remove specified events
    const updatedEvents = webhook.events.filter((event) => !events.includes(event))

    return this.updateById(webhookId, { events: updatedEvents }) as Promise<IWebhook>
  }

  /**
   * Add content types to a webhook
   */
  async addContentTypes(webhookId: string, contentTypeIds: string[]): Promise<IWebhook> {
    const webhook = await this.findByIdOrThrow(webhookId)

    // Add new content types (avoid duplicates)
    const currentContentTypes = webhook.contentTypeIds || []
    const uniqueContentTypes = [...new Set([...currentContentTypes, ...contentTypeIds])]

    return this.updateById(webhookId, { contentTypeIds: uniqueContentTypes }) as Promise<IWebhook>
  }

  /**
   * Remove content types from a webhook
   */
  async removeContentTypes(webhookId: string, contentTypeIds: string[]): Promise<IWebhook> {
    const webhook = await this.findByIdOrThrow(webhookId)

    // Remove specified content types
    const currentContentTypes = webhook.contentTypeIds || []
    const updatedContentTypes = currentContentTypes.filter((ct) => !contentTypeIds.includes(ct.toString()))

    return this.updateById(webhookId, { contentTypeIds: updatedContentTypes }) as Promise<IWebhook>
  }
}

export class WebhookDeliveryRepository extends BaseRepository<IWebhookDelivery> {
  constructor() {
    super(WebhookDeliveryModel)
  }

  /**
   * Find deliveries by webhook
   */
  async findByWebhook(webhookId: string, limit = 10): Promise<IWebhookDelivery[]> {
    return this.find({ webhook: webhookId }, undefined, { sort: { timestamp: -1 }, limit })
  }

  /**
   * Find successful deliveries
   */
  async findSuccessful(webhookId?: string, limit = 10): Promise<IWebhookDelivery[]> {
    const query: any = { success: true }
    if (webhookId) {
      query.webhook = webhookId
    }
    return this.find(query, undefined, { sort: { timestamp: -1 }, limit })
  }

  /**
   * Find failed deliveries
   */
  async findFailed(webhookId?: string, limit = 10): Promise<IWebhookDelivery[]> {
    const query: any = { success: false }
    if (webhookId) {
      query.webhook = webhookId
    }
    return this.find(query, undefined, { sort: { timestamp: -1 }, limit })
  }

  /**
   * Create a delivery record
   */
  async createDelivery(
    webhookId: string,
    success: boolean,
    request: string,
    response?: string,
    statusCode?: number,
    error?: string,
  ): Promise<IWebhookDelivery> {
    return this.create({
      webhook: webhookId,
      timestamp: new Date(),
      success,
      request,
      response,
      statusCode,
      error,
    } as any)
  }

  /**
   * Find deliveries by date range
   */
  async findByDateRange(startDate: Date, endDate: Date, webhookId?: string): Promise<IWebhookDelivery[]> {
    const query: any = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    }
    if (webhookId) {
      query.webhook = webhookId
    }
    return this.find(query, undefined, { sort: { timestamp: -1 } })
  }

  /**
   * Get delivery statistics
   */
  async getStats(webhookId?: string): Promise<{
    total: number
    successful: number
    failed: number
    successRate: number
  }> {
    const query: any = {}
    if (webhookId) {
      query.webhook = webhookId
    }

    const [total, successful] = await Promise.all([this.count(query), this.count({ ...query, success: true })])

    const failed = total - successful
    const successRate = total > 0 ? (successful / total) * 100 : 0

    return {
      total,
      successful,
      failed,
      successRate,
    }
  }
}
