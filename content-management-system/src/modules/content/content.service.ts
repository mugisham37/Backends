import { inject, injectable } from "tsyringe";
import type {
  Content,
  ContentStatus,
  ContentType,
  ContentVersion,
  NewContent,
} from "../../core/database/schema/content.schema";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors";
import { ContentRepository } from "../../core/repositories/content.repository";
import type { Result } from "../../core/types/result.types";
import { logger } from "../../shared/utils/logger";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import { SearchService } from "../search/search.service";

/**
 * Content management service with versioning and publishing
 * Handles content CRUD operations, versioning, and publishing workflows
 */
@injectable()
export class ContentService {
  constructor(
    @inject("ContentRepository") private _contentRepository: ContentRepository,
    @inject("CacheService") private _cacheService: CacheService,
    @inject("AuditService") private _auditService: AuditService,
    @inject("SearchService") private _searchService: SearchService
  ) {}

  /**
   * Get all content items with filtering and pagination
   */
  async getAllContent(
    tenantId: string,
    filter: {
      contentType?: ContentType;
      status?: ContentStatus;
      search?: string;
      authorId?: string;
      tags?: string[];
      categories?: string[];
      createdAt?: { from?: Date; to?: Date };
      updatedAt?: { from?: Date; to?: Date };
      publishedAt?: { from?: Date; to?: Date };
    } = {},
    sort: {
      field?: string;
      direction?: "asc" | "desc";
    } = {},
    pagination: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<
    Result<
      {
        content: Content[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      },
      Error
    >
  > {
    try {
      const { page = 1, limit = 20 } = pagination;

      // Build filter conditions
      const filterConditions: any = {
        tenantId,
        isLatestVersion: true, // Only get latest versions
      };

      if (filter.contentType) {
        filterConditions.contentType = filter.contentType;
      }

      if (filter.status) {
        filterConditions.status = filter.status;
      }

      if (filter.authorId) {
        filterConditions.authorId = filter.authorId;
      }

      // Date range filters
      if (filter.createdAt?.from || filter.createdAt?.to) {
        filterConditions.createdAt = {};
        if (filter.createdAt.from) {
          filterConditions.createdAt._gte = filter.createdAt.from;
        }
        if (filter.createdAt.to) {
          filterConditions.createdAt._lte = filter.createdAt.to;
        }
      }

      if (filter.updatedAt?.from || filter.updatedAt?.to) {
        filterConditions.updatedAt = {};
        if (filter.updatedAt.from) {
          filterConditions.updatedAt._gte = filter.updatedAt.from;
        }
        if (filter.updatedAt.to) {
          filterConditions.updatedAt._lte = filter.updatedAt.to;
        }
      }

      if (filter.publishedAt?.from || filter.publishedAt?.to) {
        filterConditions.publishedAt = {};
        if (filter.publishedAt.from) {
          filterConditions.publishedAt._gte = filter.publishedAt.from;
        }
        if (filter.publishedAt.to) {
          filterConditions.publishedAt._lte = filter.publishedAt.to;
        }
      }

      // Search functionality
      if (filter.search) {
        filterConditions._or = [
          { title: { _ilike: `%${filter.search}%` } },
          { excerpt: { _ilike: `%${filter.search}%` } },
          { body: { _ilike: `%${filter.search}%` } },
          { slug: { _ilike: `%${filter.search}%` } },
        ];
      }

      // Build sort options
      const sortOptions: { field: keyof Content; direction: "asc" | "desc" }[] =
        [];
      if (sort.field && (sort.field as keyof Content)) {
        sortOptions.push({
          field: sort.field as keyof Content,
          direction: sort.direction || "asc",
        });
      } else {
        sortOptions.push({ field: "updatedAt", direction: "desc" as const });
      }

      const result = await this._contentRepository.findManyPaginated({
        where: filterConditions,
        orderBy: sortOptions,
        pagination: { page, limit },
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          content: result.data.data,
          pagination: result.data.pagination,
        },
      };
    } catch (error) {
      logger.error("Error getting all content:", error);
      return {
        success: false,
        error: new Error("Failed to get content"),
      };
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(
    id: string,
    tenantId: string
  ): Promise<Result<Content, NotFoundError>> {
    try {
      // Check cache first
      const cacheKey = `content:${id}`;
      const cachedContent = await this._cacheService.get(cacheKey);
      if (cachedContent) {
        return { success: true, data: cachedContent as Content };
      }

      const result = await this._contentRepository.findByIdInTenant(
        id,
        tenantId
      );
      if (!result.success || !result.data) {
        return {
          success: false,
          error: new NotFoundError("Content not found"),
        };
      }

      // Cache content for 5 minutes
      await this._cacheService.set(cacheKey, result.data, 5 * 60);

      return result as Result<Content, NotFoundError>;
    } catch (error) {
      logger.error(`Error getting content by ID ${id}:`, error);
      return {
        success: false,
        error: new NotFoundError("Content not found"),
      };
    }
  }

  /**
   * Get content by slug
   */
  async getContentBySlug(
    slug: string,
    tenantId: string
  ): Promise<Result<Content, NotFoundError>> {
    try {
      // Check cache first
      const cacheKey = `content:slug:${tenantId}:${slug}`;
      const cachedContent = await this._cacheService.get(cacheKey);
      if (cachedContent) {
        return { success: true, data: cachedContent as Content };
      }

      const result = await this._contentRepository.findBySlug(tenantId, slug);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: new NotFoundError("Content not found"),
        };
      }

      // Cache content for 5 minutes
      await this._cacheService.set(cacheKey, result.data, 5 * 60);

      return result as Result<Content, NotFoundError>;
    } catch (error) {
      logger.error(`Error getting content by slug ${slug}:`, error);
      return {
        success: false,
        error: new NotFoundError("Content not found"),
      };
    }
  }

  /**
   * Create new content
   */
  async createContent(
    data: {
      title: string;
      slug?: string;
      excerpt?: string;
      body?: string;
      contentType?: ContentType;
      status?: ContentStatus;
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      featuredImage?: string;
      tags?: string[];
      categories?: string[];
      customFields?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      scheduledAt?: Date;
    },
    tenantId: string,
    authorId: string
  ): Promise<Result<Content, Error>> {
    try {
      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        slug = this.generateSlug(data.title);
      }

      // Validate slug format
      if (!this.isValidSlug(slug)) {
        return {
          success: false,
          error: new ValidationError(
            "Slug must contain only lowercase letters, numbers, and hyphens"
          ),
        };
      }

      // Check if slug is unique within tenant
      const existingContent = await this._contentRepository.findBySlug(
        tenantId,
        slug
      );
      if (existingContent.success && existingContent.data) {
        return {
          success: false,
          error: new ConflictError("Content with this slug already exists"),
        };
      }

      // Calculate metadata
      const metadata = {
        ...data.metadata,
        wordCount: this.calculateWordCount(data.body || ""),
        readTime: this.calculateReadTime(data.body || ""),
      };

      // Create content
      const contentData = {
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        body: data.body || null,
        contentType: data.contentType || "article",
        status: data.status || "draft",
        version: 1,
        isLatestVersion: true,
        authorId,
        tenantId,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        seoKeywords: data.seoKeywords || null,
        featuredImage: data.featuredImage || null,
        tags: data.tags || null,
        categories: data.categories || null,
        customFields: data.customFields || null,
        metadata,
        scheduledAt: data.scheduledAt || null,
      } as NewContent;

      const result = await this._contentRepository.create(contentData as any);
      if (!result.success) {
        return result;
      }

      // Create initial version
      await this._contentRepository.createVersion({
        contentId: result.data.id,
        version: 1,
        title: data.title,
        body: data.body || null,
        excerpt: data.excerpt || null,
        status: data.status || "draft",
        authorId,
        changeLog: "Initial version",
        customFields: data.customFields || null,
        metadata,
      });

      // Index content for search
      await this._searchService.indexContent(result.data);

      // Log content creation
      await this._auditService.logContentEvent({
        contentId: result.data.id,
        tenantId,
        userId: authorId,
        event: "content_created",
        details: {
          title: data.title,
          contentType: data.contentType || "article",
          timestamp: new Date(),
        },
      });

      logger.info(`Content created: ${data.title} (${result.data.id})`);

      return result;
    } catch (error) {
      logger.error("Error creating content:", error);
      return {
        success: false,
        error: new Error("Failed to create content"),
      };
    }
  }

  /**
   * Update content
   */
  async updateContent(
    id: string,
    data: {
      title?: string;
      slug?: string;
      excerpt?: string;
      body?: string;
      contentType?: ContentType;
      status?: ContentStatus;
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      featuredImage?: string;
      tags?: string[];
      categories?: string[];
      customFields?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      scheduledAt?: Date;
      changeLog?: string;
    },
    tenantId: string,
    editorId: string
  ): Promise<Result<Content, Error>> {
    try {
      // Check if content exists
      const existingContent = await this.getContentById(id, tenantId);
      if (!existingContent.success) {
        return existingContent;
      }

      // Check slug uniqueness if being updated
      if (data.slug && data.slug !== existingContent.data.slug) {
        if (!this.isValidSlug(data.slug)) {
          return {
            success: false,
            error: new ValidationError(
              "Slug must contain only lowercase letters, numbers, and hyphens"
            ),
          };
        }

        const existingSlug = await this._contentRepository.findBySlug(
          tenantId,
          data.slug
        );
        if (existingSlug.success && existingSlug.data) {
          return {
            success: false,
            error: new ConflictError("Content with this slug already exists"),
          };
        }
      }

      // Calculate updated metadata
      const updatedMetadata = {
        ...existingContent.data.metadata,
        ...data.metadata,
      };

      if (data.body) {
        updatedMetadata.wordCount = this.calculateWordCount(data.body);
        updatedMetadata.readTime = this.calculateReadTime(data.body);
      }

      // Increment version
      const newVersion = existingContent.data.version + 1;

      // Update content
      const updateData: Partial<Content> = {
        ...data,
        version: newVersion,
        editorId,
        metadata: updatedMetadata,
      };

      const result = await this._contentRepository.update(id, updateData);
      if (!result.success) {
        return result;
      }

      // Create new version
      await this._contentRepository.createVersion({
        contentId: id,
        version: newVersion,
        title: data.title || existingContent.data.title,
        body: data.body || existingContent.data.body,
        excerpt: data.excerpt || existingContent.data.excerpt,
        status: data.status || existingContent.data.status,
        authorId: editorId,
        changeLog: data.changeLog || "Content updated",
        customFields: data.customFields || existingContent.data.customFields,
        metadata: updatedMetadata,
      });

      // Clear cache
      await this._cacheService.delete(`content:${id}`);
      await this._cacheService.delete(
        `content:slug:${tenantId}:${existingContent.data.slug}`
      );

      // Update search index
      await this._searchService.updateContent(result.data);

      // Log content update
      await this._auditService.logContentEvent({
        contentId: id,
        tenantId,
        userId: editorId,
        event: "content_updated",
        details: {
          changes: data,
          version: newVersion,
          timestamp: new Date(),
        },
      });

      logger.info(`Content updated: ${result.data.title} (${id})`);

      return result;
    } catch (error) {
      logger.error(`Error updating content ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to update content"),
      };
    }
  }

  /**
   * Delete content
   */
  async deleteContent(
    id: string,
    tenantId: string,
    userId: string
  ): Promise<Result<void, Error>> {
    try {
      // Check if content exists
      const existingContent = await this.getContentById(id, tenantId);
      if (!existingContent.success) {
        return {
          success: false,
          error: existingContent.error,
        };
      }

      // Delete content
      const result = await this._contentRepository.delete(id);
      if (!result.success) {
        return result;
      }

      // Clear cache
      await this._cacheService.delete(`content:${id}`);
      await this._cacheService.delete(
        `content:slug:${tenantId}:${existingContent.data.slug}`
      );

      // Remove from search index
      await this._searchService.removeContent(id);

      // Log content deletion
      await this._auditService.logContentEvent({
        contentId: id,
        tenantId,
        userId,
        event: "content_deleted",
        details: {
          title: existingContent.data.title,
          timestamp: new Date(),
        },
      });

      logger.info(`Content deleted: ${existingContent.data.title} (${id})`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Error deleting content ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to delete content"),
      };
    }
  }

  /**
   * Publish content
   */
  async publishContent(
    id: string,
    tenantId: string,
    userId: string,
    scheduledAt?: Date
  ): Promise<Result<Content, Error>> {
    try {
      // Check if content exists
      const existingContent = await this.getContentById(id, tenantId);
      if (!existingContent.success) {
        return existingContent;
      }

      // Validate content is ready for publishing
      if (!existingContent.data.title || !existingContent.data.body) {
        return {
          success: false,
          error: new ValidationError(
            "Content must have title and body to be published"
          ),
        };
      }

      const updateData: Partial<Content> = {
        status: "published",
        publishedAt: scheduledAt || new Date(),
        scheduledAt: scheduledAt || null,
      };

      const result = await this._contentRepository.update(id, updateData);
      if (!result.success) {
        return result;
      }

      // Clear cache
      await this._cacheService.delete(`content:${id}`);
      await this._cacheService.delete(
        `content:slug:${tenantId}:${existingContent.data.slug}`
      );

      // Update search index
      await this._searchService.updateContent(result.data);

      // Log content publishing
      await this._auditService.logContentEvent({
        contentId: id,
        tenantId,
        userId,
        event: "content_published",
        details: {
          title: existingContent.data.title,
          publishedAt: updateData.publishedAt,
          scheduledAt: updateData.scheduledAt,
          timestamp: new Date(),
        },
      });

      logger.info(`Content published: ${existingContent.data.title} (${id})`);

      return result;
    } catch (error) {
      logger.error(`Error publishing content ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to publish content"),
      };
    }
  }

  /**
   * Unpublish content
   */
  async unpublishContent(
    id: string,
    tenantId: string,
    userId: string
  ): Promise<Result<Content, Error>> {
    try {
      // Check if content exists
      const existingContent = await this.getContentById(id, tenantId);
      if (!existingContent.success) {
        return existingContent;
      }

      const updateData: Partial<Content> = {
        status: "draft",
        publishedAt: null,
        scheduledAt: null,
      };

      const result = await this._contentRepository.update(id, updateData);
      if (!result.success) {
        return result;
      }

      // Clear cache
      await this._cacheService.delete(`content:${id}`);
      await this._cacheService.delete(
        `content:slug:${tenantId}:${existingContent.data.slug}`
      );

      // Update search index
      await this._searchService.updateContent(result.data);

      // Log content unpublishing
      await this._auditService.logContentEvent({
        contentId: id,
        tenantId,
        userId,
        event: "content_unpublished",
        details: {
          title: existingContent.data.title,
          timestamp: new Date(),
        },
      });

      logger.info(`Content unpublished: ${existingContent.data.title} (${id})`);

      return result;
    } catch (error) {
      logger.error(`Error unpublishing content ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to unpublish content"),
      };
    }
  }

  /**
   * Get content versions
   */
  async getContentVersions(
    contentId: string,
    tenantId: string
  ): Promise<Result<ContentVersion[], Error>> {
    try {
      // Verify content exists and belongs to tenant
      const contentExists = await this.getContentById(contentId, tenantId);
      if (!contentExists.success) {
        return {
          success: false,
          error: contentExists.error,
        };
      }

      const result = await this._contentRepository.getVersions(contentId);
      return result;
    } catch (error) {
      logger.error(`Error getting content versions for ${contentId}:`, error);
      return {
        success: false,
        error: new Error("Failed to get content versions"),
      };
    }
  }

  /**
   * Restore content version
   */
  async restoreVersion(
    contentId: string,
    versionNumber: number,
    tenantId: string,
    userId: string
  ): Promise<Result<Content, Error>> {
    try {
      // Check if content exists
      const existingContent = await this.getContentById(contentId, tenantId);
      if (!existingContent.success) {
        return existingContent;
      }

      // Get the version to restore
      const versionResult = await this._contentRepository.getVersion(
        contentId,
        versionNumber
      );
      if (!versionResult.success || !versionResult.data) {
        return {
          success: false,
          error: new NotFoundError("Version not found"),
        };
      }

      const version = versionResult.data;

      // Create new version with restored content
      const newVersion = existingContent.data.version + 1;
      const updateData: Partial<Content> = {
        title: version.title,
        body: version.body,
        excerpt: version.excerpt,
        status: version.status,
        version: newVersion,
        editorId: userId,
        customFields: version.customFields,
        metadata: version.metadata,
      };

      const result = await this._contentRepository.update(
        contentId,
        updateData
      );
      if (!result.success) {
        return result;
      }

      // Create version record
      await this._contentRepository.createVersion({
        contentId,
        version: newVersion,
        title: version.title,
        body: version.body,
        excerpt: version.excerpt,
        status: version.status,
        authorId: userId,
        changeLog: `Restored from version ${versionNumber}`,
        customFields: version.customFields,
        metadata: version.metadata,
      });

      // Clear cache
      await this._cacheService.delete(`content:${contentId}`);
      await this._cacheService.delete(
        `content:slug:${tenantId}:${existingContent.data.slug}`
      );

      // Update search index
      await this._searchService.updateContent(result.data);

      // Log version restoration
      await this._auditService.logContentEvent({
        contentId,
        tenantId,
        userId,
        event: "content_version_restored",
        details: {
          restoredVersion: versionNumber,
          newVersion,
          timestamp: new Date(),
        },
      });

      logger.info(
        `Content version restored: ${contentId} version ${versionNumber}`
      );

      return result;
    } catch (error) {
      logger.error(
        `Error restoring content version ${contentId}:${versionNumber}:`,
        error
      );
      return {
        success: false,
        error: new Error("Failed to restore content version"),
      };
    }
  }

  /**
   * Generate slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  /**
   * Validate slug format
   */
  private isValidSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && slug.length <= 255;
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Calculate estimated read time in minutes
   */
  private calculateReadTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.calculateWordCount(text);
    return Math.ceil(wordCount / wordsPerMinute);
  }
}
