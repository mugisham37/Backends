import { BaseRepository } from "./base.repository"
import { ContentModel, type IContent, ContentStatus } from "../models/content.model"
import { ApiError } from "../../utils/errors"

export class ContentRepository extends BaseRepository<IContent> {
  constructor() {
    super(ContentModel)
  }

  /**
   * Find content by content type ID
   */
  async findByContentType(contentTypeId: string): Promise<IContent[]> {
    return this.find({ contentType: contentTypeId })
  }

  /**
   * Find content by slug
   */
  async findBySlug(contentTypeId: string, slug: string, locale = "en"): Promise<IContent | null> {
    return this.findOne({
      contentType: contentTypeId,
      slug,
      locale,
    })
  }

  /**
   * Find content by slug or throw an error if not found
   */
  async findBySlugOrThrow(contentTypeId: string, slug: string, locale = "en"): Promise<IContent> {
    const content = await this.findBySlug(contentTypeId, slug, locale)
    if (!content) {
      throw ApiError.notFound(`Content not found with slug: ${slug}`)
    }
    return content
  }

  /**
   * Find published content
   */
  async findPublished(contentTypeId?: string): Promise<IContent[]> {
    const query: any = { status: ContentStatus.PUBLISHED }
    if (contentTypeId) {
      query.contentType = contentTypeId
    }
    return this.find(query)
  }

  /**
   * Find draft content
   */
  async findDrafts(contentTypeId?: string): Promise<IContent[]> {
    const query: any = { status: ContentStatus.DRAFT }
    if (contentTypeId) {
      query.contentType = contentTypeId
    }
    return this.find(query)
  }

  /**
   * Find archived content
   */
  async findArchived(contentTypeId?: string): Promise<IContent[]> {
    const query: any = { status: ContentStatus.ARCHIVED }
    if (contentTypeId) {
      query.contentType = contentTypeId
    }
    return this.find(query)
  }

  /**
   * Publish content
   */
  async publish(contentId: string, userId?: string, scheduledAt?: Date): Promise<IContent> {
    const content = await this.findByIdOrThrow(contentId)

    if (content.status === ContentStatus.ARCHIVED) {
      throw ApiError.badRequest("Cannot publish archived content")
    }

    const updateData: any = {
      status: ContentStatus.PUBLISHED,
      publishedAt: scheduledAt || new Date(),
    }

    if (userId) {
      updateData.publishedBy = userId
    }

    return this.updateByIdOrThrow(contentId, updateData)
  }

  /**
   * Unpublish content
   */
  async unpublish(contentId: string): Promise<IContent> {
    const content = await this.findByIdOrThrow(contentId)

    if (content.status !== ContentStatus.PUBLISHED) {
      throw ApiError.badRequest("Content is not published")
    }

    return this.updateByIdOrThrow(contentId, {
      status: ContentStatus.DRAFT,
    })
  }

  /**
   * Archive content
   */
  async archive(contentId: string): Promise<IContent> {
    return this.updateByIdOrThrow(contentId, {
      status: ContentStatus.ARCHIVED,
    })
  }

  /**
   * Restore a specific version of content
   */
  async restoreVersion(contentId: string, versionId: string): Promise<IContent> {
    const content = await this.findByIdOrThrow(contentId)

    // Find the version
    const version = content.versions.find((v) => v._id.toString() === versionId)
    if (!version) {
      throw ApiError.notFound(`Version not found with ID: ${versionId}`)
    }

    // Update the content data with the version data
    content.data = version.data
    await content.save()

    return content
  }

  /**
   * Search content
   */
  async search(query: string, contentTypeId?: string): Promise<IContent[]> {
    const searchQuery: any = {}

    // Add content type filter if provided
    if (contentTypeId) {
      searchQuery.contentType = contentTypeId
    }

    // Add text search
    // Note: This is a simple implementation. For production, consider using
    // MongoDB text indexes or Elasticsearch for more powerful search capabilities.
    searchQuery.$or = [
      { "data.title": new RegExp(query, "i") },
      { "data.name": new RegExp(query, "i") },
      { "data.description": new RegExp(query, "i") },
      { slug: new RegExp(query, "i") },
    ]

    return this.find(searchQuery)
  }

  /**
   * Find content by creator
   */
  async findByCreator(userId: string): Promise<IContent[]> {
    return this.find({ createdBy: userId })
  }

  /**
   * Find content updated by a specific user
   */
  async findByUpdater(userId: string): Promise<IContent[]> {
    return this.find({ updatedBy: userId })
  }

  /**
   * Find content published by a specific user
   */
  async findByPublisher(userId: string): Promise<IContent[]> {
    return this.find({ publishedBy: userId })
  }

  /**
   * Find content created within a date range
   */
  async findByCreationDate(startDate: Date, endDate: Date): Promise<IContent[]> {
    return this.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
  }

  /**
   * Find content updated within a date range
   */
  async findByUpdateDate(startDate: Date, endDate: Date): Promise<IContent[]> {
    return this.find({
      updatedAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
  }

  /**
   * Find content published within a date range
   */
  async findByPublishDate(startDate: Date, endDate: Date): Promise<IContent[]> {
    return this.find({
      publishedAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
  }
}
