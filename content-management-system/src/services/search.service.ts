import { searchDocuments, indexDocument, updateDocument, deleteDocument, reindexCollection } from "../db/elasticsearch"
import { logger } from "../utils/logger"
import { config } from "../config"
import { withCache, invalidateCache } from "../db/redis"

/**
 * Service for search functionality
 */
export class SearchService {
  /**
   * Search content
   */
  public async searchContent(params: {
    query: string
    contentTypeId?: string
    status?: string
    locale?: string
    fields?: string[]
    from?: number
    size?: number
    sort?: string
    order?: "asc" | "desc"
    filters?: Record<string, any>
  }): Promise<{
    hits: any[]
    total: number
    aggregations?: any
  }> {
    try {
      const {
        query,
        contentTypeId,
        status,
        locale,
        fields = ["title", "description", "data"],
        from = 0,
        size = 10,
        sort,
        order = "desc",
        filters = {},
      } = params

      // Build search query
      const searchQuery: any = {
        query: {
          bool: {
            must: [
              query
                ? {
                    multi_match: {
                      query,
                      fields,
                      type: "best_fields",
                      fuzziness: "AUTO",
                    },
                  }
                : { match_all: {} },
            ],
            filter: [],
          },
        },
        highlight: {
          fields: {
            title: {},
            description: {},
            "data.*": {},
          },
          pre_tags: ["<em>"],
          post_tags: ["</em>"],
        },
        aggs: {
          content_types: {
            terms: {
              field: "contentTypeId",
              size: 20,
            },
          },
          statuses: {
            terms: {
              field: "status",
              size: 10,
            },
          },
          locales: {
            terms: {
              field: "locale",
              size: 10,
            },
          },
        },
      }

      // Add filters
      if (contentTypeId) {
        searchQuery.query.bool.filter.push({ term: { contentTypeId } })
      }

      if (status) {
        searchQuery.query.bool.filter.push({ term: { status } })
      }

      if (locale) {
        searchQuery.query.bool.filter.push({ term: { locale } })
      }

      // Add custom filters
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          searchQuery.query.bool.filter.push({ terms: { [key]: value } })
        } else {
          searchQuery.query.bool.filter.push({ term: { [key]: value } })
        }
      })

      // Add sorting
      const sortOptions: any = {}
      if (sort) {
        sortOptions[sort] = { order }
      } else {
        sortOptions._score = { order: "desc" }
      }

      // Cache key
      const cacheKey = `search:content:${JSON.stringify({
        query,
        contentTypeId,
        status,
        locale,
        fields,
        from,
        size,
        sort,
        order,
        filters,
      })}`

      // Execute search with caching
      return await withCache(
        cacheKey,
        async () => {
          return await searchDocuments("content", searchQuery, {
            from,
            size,
            sort: sortOptions,
          })
        },
        { ttl: 300 }, // Cache for 5 minutes
      )
    } catch (error) {
      logger.error("Error searching content:", error)
      throw error
    }
  }

  /**
   * Search users
   */
  public async searchUsers(params: {
    query: string
    role?: string
    isActive?: boolean
    fields?: string[]
    from?: number
    size?: number
    sort?: string
    order?: "asc" | "desc"
  }): Promise<{
    hits: any[]
    total: number
    aggregations?: any
  }> {
    try {
      const {
        query,
        role,
        isActive,
        fields = ["email", "firstName", "lastName"],
        from = 0,
        size = 10,
        sort,
        order = "desc",
      } = params

      // Build search query
      const searchQuery: any = {
        query: {
          bool: {
            must: [
              query
                ? {
                    multi_match: {
                      query,
                      fields,
                      type: "best_fields",
                      fuzziness: "AUTO",
                    },
                  }
                : { match_all: {} },
            ],
            filter: [],
          },
        },
        highlight: {
          fields: {
            email: {},
            firstName: {},
            lastName: {},
          },
          pre_tags: ["<em>"],
          post_tags: ["</em>"],
        },
        aggs: {
          roles: {
            terms: {
              field: "role",
              size: 10,
            },
          },
          active_status: {
            terms: {
              field: "isActive",
              size: 2,
            },
          },
        },
      }

      // Add filters
      if (role) {
        searchQuery.query.bool.filter.push({ term: { role } })
      }

      if (isActive !== undefined) {
        searchQuery.query.bool.filter.push({ term: { isActive } })
      }

      // Add sorting
      const sortOptions: any = {}
      if (sort) {
        sortOptions[sort] = { order }
      } else {
        sortOptions._score = { order: "desc" }
      }

      // Cache key
      const cacheKey = `search:users:${JSON.stringify({
        query,
        role,
        isActive,
        fields,
        from,
        size,
        sort,
        order,
      })}`

      // Execute search with caching
      return await withCache(
        cacheKey,
        async () => {
          return await searchDocuments("users", searchQuery, {
            from,
            size,
            sort: sortOptions,
          })
        },
        { ttl: 300 }, // Cache for 5 minutes
      )
    } catch (error) {
      logger.error("Error searching users:", error)
      throw error
    }
  }

  /**
   * Search media
   */
  public async searchMedia(params: {
    query: string
    type?: string
    mimeType?: string
    folder?: string
    tags?: string[]
    fields?: string[]
    from?: number
    size?: number
    sort?: string
    order?: "asc" | "desc"
  }): Promise<{
    hits: any[]
    total: number
    aggregations?: any
  }> {
    try {
      const {
        query,
        type,
        mimeType,
        folder,
        tags,
        fields = ["filename", "originalFilename", "alt", "title", "description", "tags"],
        from = 0,
        size = 10,
        sort,
        order = "desc",
      } = params

      // Build search query
      const searchQuery: any = {
        query: {
          bool: {
            must: [
              query
                ? {
                    multi_match: {
                      query,
                      fields,
                      type: "best_fields",
                      fuzziness: "AUTO",
                    },
                  }
                : { match_all: {} },
            ],
            filter: [],
          },
        },
        highlight: {
          fields: {
            filename: {},
            originalFilename: {},
            alt: {},
            title: {},
            description: {},
            tags: {},
          },
          pre_tags: ["<em>"],
          post_tags: ["</em>"],
        },
        aggs: {
          types: {
            terms: {
              field: "type",
              size: 10,
            },
          },
          mime_types: {
            terms: {
              field: "mimeType",
              size: 20,
            },
          },
          folders: {
            terms: {
              field: "folder",
              size: 20,
            },
          },
          tags: {
            terms: {
              field: "tags",
              size: 30,
            },
          },
        },
      }

      // Add filters
      if (type) {
        searchQuery.query.bool.filter.push({ term: { type } })
      }

      if (mimeType) {
        searchQuery.query.bool.filter.push({ term: { mimeType } })
      }

      if (folder) {
        searchQuery.query.bool.filter.push({ term: { folder } })
      }

      if (tags && tags.length > 0) {
        searchQuery.query.bool.filter.push({ terms: { tags } })
      }

      // Add sorting
      const sortOptions: any = {}
      if (sort) {
        sortOptions[sort] = { order }
      } else {
        sortOptions._score = { order: "desc" }
      }

      // Cache key
      const cacheKey = `search:media:${JSON.stringify({
        query,
        type,
        mimeType,
        folder,
        tags,
        fields,
        from,
        size,
        sort,
        order,
      })}`

      // Execute search with caching
      return await withCache(
        cacheKey,
        async () => {
          return await searchDocuments("media", searchQuery, {
            from,
            size,
            sort: sortOptions,
          })
        },
        { ttl: 300 }, // Cache for 5 minutes
      )
    } catch (error) {
      logger.error("Error searching media:", error)
      throw error
    }
  }

  /**
   * Reindex all content
   */
  public async reindexContent(contentCollection: any[]): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) {
        logger.info("Elasticsearch is disabled, skipping reindexing")
        return
      }

      logger.info(`Reindexing ${contentCollection.length} content items`)

      // Transform content for indexing
      const transform = (content: any) => {
        // Extract searchable fields from data
        const { title, description } = content.data || {}

        return {
          id: content._id.toString(),
          contentTypeId: content.contentTypeId.toString(),
          title,
          description,
          slug: content.slug,
          status: content.status,
          locale: content.locale,
          data: content.data,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
          publishedAt: content.publishedAt,
          createdBy: content.createdBy?.toString(),
          updatedBy: content.updatedBy?.toString(),
          publishedBy: content.publishedBy?.toString(),
        }
      }

      await reindexCollection("content", contentCollection, transform)

      // Invalidate cache
      await invalidateCache("search:content:*")

      logger.info("Content reindexing completed")
    } catch (error) {
      logger.error("Error reindexing content:", error)
      throw error
    }
  }

  /**
   * Reindex all users
   */
  public async reindexUsers(userCollection: any[]): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) {
        logger.info("Elasticsearch is disabled, skipping reindexing")
        return
      }

      logger.info(`Reindexing ${userCollection.length} users`)

      // Transform users for indexing
      const transform = (user: any) => {
        return {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      }

      await reindexCollection("users", userCollection, transform)

      // Invalidate cache
      await invalidateCache("search:users:*")

      logger.info("Users reindexing completed")
    } catch (error) {
      logger.error("Error reindexing users:", error)
      throw error
    }
  }

  /**
   * Reindex all media
   */
  public async reindexMedia(mediaCollection: any[]): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) {
        logger.info("Elasticsearch is disabled, skipping reindexing")
        return
      }

      logger.info(`Reindexing ${mediaCollection.length} media items`)

      // Transform media for indexing
      const transform = (media: any) => {
        return {
          id: media._id.toString(),
          filename: media.filename,
          originalFilename: media.originalFilename,
          mimeType: media.mimeType,
          type: media.type,
          size: media.size,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          alt: media.alt,
          title: media.title,
          description: media.description,
          tags: media.tags,
          folder: media.folder,
          createdAt: media.createdAt,
          createdBy: media.createdBy?.toString(),
          updatedAt: media.updatedAt,
        }
      }

      await reindexCollection("media", mediaCollection, transform)

      // Invalidate cache
      await invalidateCache("search:media:*")

      logger.info("Media reindexing completed")
    } catch (error) {
      logger.error("Error reindexing media:", error)
      throw error
    }
  }

  /**
   * Index a single content item
   */
  public async indexContent(content: any): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      // Extract searchable fields from data
      const { title, description } = content.data || {}

      await indexDocument("content", {
        id: content._id.toString(),
        contentTypeId: content.contentTypeId.toString(),
        title,
        description,
        slug: content.slug,
        status: content.status,
        locale: content.locale,
        data: content.data,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        publishedAt: content.publishedAt,
        createdBy: content.createdBy?.toString(),
        updatedBy: content.updatedBy?.toString(),
        publishedBy: content.publishedBy?.toString(),
      })

      // Invalidate cache
      await invalidateCache(`search:content:*`)
    } catch (error) {
      logger.error("Error indexing content:", error)
      throw error
    }
  }

  /**
   * Update a single content item in the index
   */
  public async updateContentIndex(id: string, content: any): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      // Extract searchable fields from data
      const { title, description } = content.data || {}

      await updateDocument("content", id, {
        contentTypeId: content.contentTypeId.toString(),
        title,
        description,
        slug: content.slug,
        status: content.status,
        locale: content.locale,
        data: content.data,
        updatedAt: content.updatedAt,
        publishedAt: content.publishedAt,
        updatedBy: content.updatedBy?.toString(),
        publishedBy: content.publishedBy?.toString(),
      })

      // Invalidate cache
      await invalidateCache(`search:content:*`)
    } catch (error) {
      logger.error("Error updating content index:", error)
      throw error
    }
  }

  /**
   * Delete a content item from the index
   */
  public async deleteContentFromIndex(id: string): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await deleteDocument("content", id)

      // Invalidate cache
      await invalidateCache(`search:content:*`)
    } catch (error) {
      logger.error("Error deleting content from index:", error)
      throw error
    }
  }

  /**
   * Index a single user
   */
  public async indexUser(user: any): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await indexDocument("users", {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })

      // Invalidate cache
      await invalidateCache(`search:users:*`)
    } catch (error) {
      logger.error("Error indexing user:", error)
      throw error
    }
  }

  /**
   * Update a single user in the index
   */
  public async updateUserIndex(id: string, user: any): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await updateDocument("users", id, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        updatedAt: user.updatedAt,
      })

      // Invalidate cache
      await invalidateCache(`search:users:*`)
    } catch (error) {
      logger.error("Error updating user index:", error)
      throw error
    }
  }

  /**
   * Delete a user from the index
   */
  public async deleteUserFromIndex(id: string): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await deleteDocument("users", id)

      // Invalidate cache
      await invalidateCache(`search:users:*`)
    } catch (error) {
      logger.error("Error deleting user from index:", error)
      throw error
    }
  }

  /**
   * Index a single media item
   */
  public async indexMedia(media: any): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await indexDocument("media", {
        id: media._id.toString(),
        filename: media.filename,
        originalFilename: media.originalFilename,
        mimeType: media.mimeType,
        type: media.type,
        size: media.size,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        alt: media.alt,
        title: media.title,
        description: media.description,
        tags: media.tags,
        folder: media.folder,
        createdAt: media.createdAt,
        createdBy: media.createdBy?.toString(),
        updatedAt: media.updatedAt,
      })

      // Invalidate cache
      await invalidateCache(`search:media:*`)
    } catch (error) {
      logger.error("Error indexing media:", error)
      throw error
    }
  }

  /**
   * Update a single media item in the index
   */
  public async updateMediaIndex(id: string, media: any): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await updateDocument("media", id, {
        filename: media.filename,
        originalFilename: media.originalFilename,
        mimeType: media.mimeType,
        type: media.type,
        size: media.size,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        alt: media.alt,
        title: media.title,
        description: media.description,
        tags: media.tags,
        folder: media.folder,
        updatedAt: media.updatedAt,
      })

      // Invalidate cache
      await invalidateCache(`search:media:*`)
    } catch (error) {
      logger.error("Error updating media index:", error)
      throw error
    }
  }

  /**
   * Delete a media item from the index
   */
  public async deleteMediaFromIndex(id: string): Promise<void> {
    try {
      if (!config.elasticsearch.enabled) return

      await deleteDocument("media", id)

      // Invalidate cache
      await invalidateCache(`search:media:*`)
    } catch (error) {
      logger.error("Error deleting media from index:", error)
      throw error
    }
  }
}

// Export singleton instance
export const searchService = new SearchService()
