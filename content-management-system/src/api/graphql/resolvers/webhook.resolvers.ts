import { WebhookService } from "../../../services/webhook.service"
import { ApiError } from "../../../utils/errors"
import { generateCursor } from "../../../utils/helpers"
import { WebhookEvent, WebhookStatus } from "../../../db/models/webhook.model"

const webhookService = new WebhookService()

export const webhookResolvers = {
  Query: {
    webhooks: async (_: any, args: any, context: any) => {
      const { filter = {}, pagination = {} } = args
      const { first, after, last, before } = pagination

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.search) serviceFilter.search = filter.search
      if (filter.event) serviceFilter.event = filter.event
      if (filter.status) serviceFilter.status = filter.status
      if (filter.contentTypeId) serviceFilter.contentTypeId = filter.contentTypeId

      // For cursor-based pagination, we need to implement custom logic
      // This is a simplified version
      const limit = first || last || 10
      const result = await webhookService.getAllWebhooks(
        serviceFilter,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const webhooks = result.webhooks.slice(0, limit)
      const hasNextPage = result.webhooks.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = webhooks.map((webhook) => ({
        cursor: generateCursor(webhook._id.toString()),
        node: webhook,
      }))

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount: result.totalCount,
      }
    },

    webhook: async (_: any, args: any, context: any) => {
      const { id } = args
      return webhookService.getWebhookById(id)
    },

    webhookDeliveries: async (_: any, args: any, context: any) => {
      const { webhookId, last } = args
      return webhookService.getWebhookDeliveries(webhookId, last)
    },
  },

  Mutation: {
    createWebhook: async (_: any, args: any, context: any) => {
      const { input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can create webhooks)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to create webhooks")
      }

      return webhookService.createWebhook(input)
    },

    updateWebhook: async (_: any, args: any, context: any) => {
      const { id, input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can update webhooks)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to update webhooks")
      }

      return webhookService.updateWebhook(id, input)
    },

    deleteWebhook: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can delete webhooks)
      if (user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to delete webhooks")
      }

      await webhookService.deleteWebhook(id)
      return true
    },

    testWebhook: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can test webhooks)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to test webhooks")
      }

      return webhookService.testWebhook(id)
    },

    retryWebhookDelivery: async (_: any, args: any, context: any) => {
      const { deliveryId } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can retry webhook deliveries)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to retry webhook deliveries")
      }

      return webhookService.retryWebhookDelivery(deliveryId)
    },
  },

  Webhook: {
    id: (parent: any) => parent._id || parent.id,
    deliveries: async (parent: any, args: any) => {
      const { last } = args
      return webhookService.getWebhookDeliveries(parent._id, last)
    },
  },

  WebhookDelivery: {
    id: (parent: any) => parent._id || parent.id,
  },

  WebhookEvent: {
    content_created: WebhookEvent.CONTENT_CREATED,
    content_updated: WebhookEvent.CONTENT_UPDATED,
    content_deleted: WebhookEvent.CONTENT_DELETED,
    content_published: WebhookEvent.CONTENT_PUBLISHED,
    content_unpublished: WebhookEvent.CONTENT_UNPUBLISHED,
    content_archived: WebhookEvent.CONTENT_ARCHIVED,
    media_uploaded: WebhookEvent.MEDIA_UPLOADED,
    media_updated: WebhookEvent.MEDIA_UPDATED,
    media_deleted: WebhookEvent.MEDIA_DELETED,
    user_created: WebhookEvent.USER_CREATED,
    user_updated: WebhookEvent.USER_UPDATED,
    user_deleted: WebhookEvent.USER_DELETED,
    workflow_started: WebhookEvent.WORKFLOW_STARTED,
    workflow_completed: WebhookEvent.WORKFLOW_COMPLETED,
    workflow_step_completed: WebhookEvent.WORKFLOW_STEP_COMPLETED,
  },

  WebhookStatus: {
    active: WebhookStatus.ACTIVE,
    inactive: WebhookStatus.INACTIVE,
  },
}
