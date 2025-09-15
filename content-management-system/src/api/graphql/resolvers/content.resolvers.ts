import { ContentService } from "../../../services/content.service"
import { ApiError } from "../../../utils/errors"
import { generateCursor } from "../../../utils/helpers"
import { ContentStatus } from "../../../db/models/content.model"

const contentService = new ContentService()

export const contentResolvers = {
  Query: {
    contents: async (_: any, args: any, context: any) => {
      const { filter = {}, sort = {}, pagination = {} } = args
      const { first, after, last, before } = pagination

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.contentTypeId) serviceFilter.contentTypeId = filter.contentTypeId
      if (filter.status) serviceFilter.status = filter.status
      if (filter.locale) serviceFilter.locale = filter.locale
      if (filter.search) serviceFilter.search = filter.search
      if (filter.createdBy) serviceFilter.createdBy = filter.createdBy
      if (filter.updatedBy) serviceFilter.updatedBy = filter.updatedBy
      if (filter.publishedBy) serviceFilter.publishedBy = filter.publishedBy

      // Handle date ranges
      if (filter.createdAt) {
        serviceFilter.createdAt = {
          from: filter.createdAt.from,
          to: filter.createdAt.to,
        }
      }

      if (filter.updatedAt) {
        serviceFilter.updatedAt = {
          from: filter.updatedAt.from,
          to: filter.updatedAt.to,
        }
      }

      if (filter.publishedAt) {
        serviceFilter.publishedAt = {
          from: filter.publishedAt.from,
          to: filter.publishedAt.to,
        }
      }

      // Convert GraphQL sort to service sort
      const serviceSort: any = {}
      if (sort?.field) {
        serviceSort.field = sort.field
        serviceSort.direction = sort.direction.toLowerCase()
      }

      // For cursor-based pagination, we need to implement custom logic
      // This is a simplified version
      const limit = first || last || 10
      const result = await contentService.getAllContent(
        serviceFilter,
        serviceSort,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const contents = result.content.slice(0, limit)
      const hasNextPage = result.content.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = contents.map((content) => ({
        cursor: generateCursor(content._id.toString()),
        node: content,
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

    content: async (_: any, args: any, context: any) => {
      const { id } = args
      return contentService.getContentById(id)
    },

    contentBySlug: async (_: any, args: any, context: any) => {
      const { contentTypeId, slug, locale } = args
      return contentService.getContentBySlug(contentTypeId, slug, locale)
    },

    contentVersion: async (_: any, args: any, context: any) => {
      const { contentId, versionId } = args
      return contentService.getContentVersion(contentId, versionId)
    },
  },

  Mutation: {
    createContent: async (_: any, args: any, context: any) => {
      const { input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (all authenticated users can create content)
      return contentService.createContent(input, user._id)
    },

    updateContent: async (_: any, args: any, context: any) => {
      const { id, input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // In a real application, you would check if the user has permission to update this specific content
      // For simplicity, we'll allow all authenticated users to update content
      return contentService.updateContent(id, input, user._id)
    },

    deleteContent: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can delete content)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to delete content")
      }

      await contentService.deleteContent(id)
      return true
    },

    publishContent: async (_: any, args: any, context: any) => {
      const { id, scheduledAt } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can publish content)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to publish content")
      }

      return contentService.publishContent(id, user._id, scheduledAt)
    },

    unpublishContent: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can unpublish content)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to unpublish content")
      }

      return contentService.unpublishContent(id)
    },

    archiveContent: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can archive content)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to archive content")
      }

      return contentService.archiveContent(id)
    },

    restoreVersion: async (_: any, args: any, context: any) => {
      const { contentId, versionId } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can restore versions)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to restore content versions")
      }

      return contentService.restoreVersion(contentId, versionId, user._id)
    },
  },

  Content: {
    id: (parent: any) => parent._id || parent.id,
    contentType: async (parent: any) => {
      if (parent.contentType && typeof parent.contentType !== "string") {
        return parent.contentType
      }
      // If contentType is a string (ID), it needs to be resolved
      // In a real implementation, you would use a DataLoader for this
      const content = await contentService.getContentById(parent._id)
      return content.contentType
    },
    createdBy: (parent: any) => {
      if (parent.createdBy && typeof parent.createdBy !== "string") {
        return parent.createdBy
      }
      return null
    },
    updatedBy: (parent: any) => {
      if (parent.updatedBy && typeof parent.updatedBy !== "string") {
        return parent.updatedBy
      }
      return null
    },
    publishedBy: (parent: any) => {
      if (parent.publishedBy && typeof parent.publishedBy !== "string") {
        return parent.publishedBy
      }
      return null
    },
  },

  ContentVersion: {
    id: (parent: any) => parent._id || parent.id,
    createdBy: (parent: any) => {
      if (parent.createdBy && typeof parent.createdBy !== "string") {
        return parent.createdBy
      }
      return null
    },
  },

  ContentStatus: {
    draft: ContentStatus.DRAFT,
    published: ContentStatus.PUBLISHED,
    archived: ContentStatus.ARCHIVED,
  },
}
