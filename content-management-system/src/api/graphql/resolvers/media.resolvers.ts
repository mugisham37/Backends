import { MediaService } from "../../../services/media.service"
import { ApiError } from "../../../utils/errors"
import { generateCursor } from "../../../utils/helpers"
import { MediaType } from "../../../db/models/media.model"

const mediaService = new MediaService()

export const mediaResolvers = {
  Query: {
    media: async (_: any, args: any, context: any) => {
      const { filter = {}, sort = {}, pagination = {} } = args
      const { first, after, last, before } = pagination

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.type) serviceFilter.type = filter.type
      if (filter.search) serviceFilter.search = filter.search
      if (filter.mimeType) serviceFilter.mimeType = filter.mimeType
      if (filter.folder) serviceFilter.folder = filter.folder
      if (filter.tags) serviceFilter.tags = filter.tags
      if (filter.createdBy) serviceFilter.createdBy = filter.createdBy

      // Handle date range
      if (filter.createdAt) {
        serviceFilter.createdAt = {
          from: filter.createdAt.from,
          to: filter.createdAt.to,
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
      const result = await mediaService.getAllMedia(
        serviceFilter,
        serviceSort,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const mediaItems = result.media.slice(0, limit)
      const hasNextPage = result.media.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = mediaItems.map((media) => ({
        cursor: generateCursor(media._id.toString()),
        node: media,
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

    mediaItem: async (_: any, args: any, context: any) => {
      const { id } = args
      return mediaService.getMediaById(id)
    },
  },

  Mutation: {
    uploadMedia: async (_: any, args: any, context: any) => {
      const { file, folder, metadata } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Process the uploaded file
      // In a real GraphQL implementation, you would use a library like graphql-upload
      // For this example, we'll assume the file is already processed
      const processedFile = {
        buffer: Buffer.from("example"), // This would be the actual file buffer
        originalname: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      }

      return mediaService.uploadMedia(
        processedFile,
        {
          folder,
          metadata,
        },
        user._id,
      )
    },

    updateMedia: async (_: any, args: any, context: any) => {
      const { id, input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      return mediaService.updateMedia(id, input)
    },

    deleteMedia: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can delete media)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to delete media")
      }

      await mediaService.deleteMedia(id)
      return true
    },

    createFolder: async (_: any, args: any, context: any) => {
      const { name, parentFolder } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      return mediaService.createFolder(name, parentFolder)
    },

    deleteFolder: async (_: any, args: any, context: any) => {
      const { path } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins, editors, and authors can delete folders)
      if (!["admin", "editor", "author"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to delete folders")
      }

      await mediaService.deleteFolder(path)
      return true
    },
  },

  Media: {
    id: (parent: any) => parent._id || parent.id,
    createdBy: (parent: any) => {
      if (parent.createdBy && typeof parent.createdBy !== "string") {
        return parent.createdBy
      }
      return null
    },
  },

  MediaType: {
    image: MediaType.IMAGE,
    video: MediaType.VIDEO,
    document: MediaType.DOCUMENT,
    audio: MediaType.AUDIO,
    other: MediaType.OTHER,
  },
}
