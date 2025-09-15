import { ContentTypeService } from "../../../services/content-type.service"
import { ApiError } from "../../../utils/errors"
import { generateCursor } from "../../../utils/helpers"

const contentTypeService = new ContentTypeService()

export const contentTypeResolvers = {
  Query: {
    contentTypes: async (_: any, args: any, context: any) => {
      const { filter = {}, sort = {}, pagination = {} } = args
      const { first, after, last, before } = pagination

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.search) serviceFilter.search = filter.search
      if (filter.isSystem !== undefined) serviceFilter.isSystem = filter.isSystem

      // Convert GraphQL sort to service sort
      const serviceSort: any = {}
      if (sort?.field) {
        serviceSort.field = sort.field
        serviceSort.direction = sort.direction.toLowerCase()
      }

      // For cursor-based pagination, we need to implement custom logic
      // This is a simplified version
      const limit = first || last || 10
      const result = await contentTypeService.getAllContentTypes(
        serviceFilter,
        serviceSort,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const contentTypes = result.contentTypes.slice(0, limit)
      const hasNextPage = result.contentTypes.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = contentTypes.map((contentType) => ({
        cursor: generateCursor(contentType._id.toString()),
        node: contentType,
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

    contentType: async (_: any, args: any, context: any) => {
      const { id } = args
      return contentTypeService.getContentTypeById(id)
    },
  },

  Mutation: {
    createContentType: async (_: any, args: any, context: any) => {
      const { input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can create content types)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to create content types")
      }

      return contentTypeService.createContentType(input)
    },

    updateContentType: async (_: any, args: any, context: any) => {
      const { id, input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can update content types)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to update content types")
      }

      return contentTypeService.updateContentType(id, input)
    },

    deleteContentType: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can delete content types)
      if (user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to delete content types")
      }

      await contentTypeService.deleteContentType(id)
      return true
    },

    addField: async (_: any, args: any, context: any) => {
      const { contentTypeId, field } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can add fields)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to add fields")
      }

      return contentTypeService.addField(contentTypeId, field)
    },

    updateField: async (_: any, args: any, context: any) => {
      const { contentTypeId, fieldId, field } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can update fields)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to update fields")
      }

      return contentTypeService.updateField(contentTypeId, fieldId, field)
    },

    removeField: async (_: any, args: any, context: any) => {
      const { contentTypeId, fieldId } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can remove fields)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to remove fields")
      }

      return contentTypeService.removeField(contentTypeId, fieldId)
    },
  },

  ContentType: {
    id: (parent: any) => parent._id || parent.id,
  },

  Field: {
    id: (parent: any) => parent._id || parent.id,
  },
}
