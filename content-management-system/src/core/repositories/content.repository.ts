import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { injectable } from "tsyringe";
import {
  contents,
  contentVersions,
} from "../database/schema/content.schema.js";
import { DatabaseError } from "../errors/database.error.js";
import type {
  FilterOptions,
  PaginatedResult,
} from "../types/database.types.js";
import type { Result } from "../types/result.types.js";
import { TenantBaseRepository } from "./tenant-base.repository.js";

/**
 * Content entity type
 */
export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;

/**
 * Content-specific filter options
 */
export interface ContentFilterOptions extends FilterOptions<Content> {
  status?: string | string[];
  type?: string | string[];
  authorId?: string;
  search?: string; // Search in title, excerpt, body
  tags?: string[];
  isPublished?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
}

/**
 * Content repository implementation
 * Handles all database operations for contents
 */
@injectable()
export class ContentRepository extends TenantBaseRepository<Content> {
  constructor() {
    super(contents);
  }

  /**
   * Find content by slug within a tenant
   */
  async findBySlug(
    tenantId: string,
    slug: string
  ): Promise<Result<Content | null, Error>> {
    try {
      const [content] = await this.db
        .select()
        .from(this.table)
        .where(and(eq(contents.tenantId, tenantId), eq(contents.slug, slug)))
        .limit(1);

      return { success: true, data: (content as Content) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find content by slug",
          "findBySlug",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find published content
   */
  async findPublished(
    tenantId: string,
    options: FilterOptions<Content> = {}
  ): Promise<Result<PaginatedResult<Content>, Error>> {
    try {
      const filterOptions: FilterOptions<Content> = {
        ...options,
      };

      const conditions = [
        eq(contents.tenantId, tenantId),
        eq(contents.status, "published"),
        sql`${contents.publishedAt} <= NOW()`,
      ];

      (filterOptions as any).where = and(...conditions);

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find published content",
          "findPublished",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find content by author
   */
  async findByAuthor(
    tenantId: string,
    authorId: string,
    options: FilterOptions<Content> = {}
  ): Promise<Result<PaginatedResult<Content>, Error>> {
    try {
      const filterOptions: FilterOptions<Content> = {
        ...options,
      };

      const conditions = [
        eq(contents.tenantId, tenantId),
        eq(contents.authorId, authorId),
      ];

      (filterOptions as any).where = and(...conditions);

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find content by author",
          "findByAuthor",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Search content with advanced filtering
   */
  async searchContent(
    tenantId: string,
    options: ContentFilterOptions = {}
  ): Promise<Result<PaginatedResult<Content>, Error>> {
    try {
      const conditions = [eq(contents.tenantId, tenantId)];

      // Add status filter
      if (options.status) {
        if (Array.isArray(options.status)) {
          if (options.status.length > 0) {
            conditions.push(
              or(
                ...options.status.map((status) => eq(contents.status, status))
              )!
            );
          }
        } else {
          conditions.push(eq(contents.status, options.status));
        }
      }

      // Add type filter
      if (options.type) {
        if (Array.isArray(options.type)) {
          if (options.type.length > 0) {
            conditions.push(
              or(...options.type.map((type) => eq(contents.contentType, type)))!
            );
          }
        } else {
          conditions.push(eq(contents.contentType, options.type));
        }
      }

      // Add author filter
      if (options.authorId) {
        conditions.push(eq(contents.authorId, options.authorId));
      }

      // Add search filter
      if (options.search) {
        const searchTerm = `%${options.search}%`;
        conditions.push(
          or(
            ilike(contents.title, searchTerm),
            ilike(contents.excerpt, searchTerm),
            ilike(contents.body, searchTerm)
          )!
        );
      }

      // Add tags filter
      if (options.tags && options.tags.length > 0) {
        // Assuming tags is a JSON array field
        conditions.push(
          sql`${contents.tags} && ${JSON.stringify(options.tags)}`
        );
      }

      // Add published filter
      if (typeof options.isPublished === "boolean") {
        if (options.isPublished) {
          conditions.push(
            and(
              eq(contents.status, "published"),
              sql`${contents.publishedAt} <= NOW()`
            )!
          );
        } else {
          conditions.push(
            or(
              sql`${contents.status} != 'published'`,
              sql`${contents.publishedAt} > NOW()`
            )!
          );
        }
      }

      // Add date range filters
      if (options.publishedAfter) {
        conditions.push(
          sql`${contents.publishedAt} >= ${options.publishedAfter}`
        );
      }

      if (options.publishedBefore) {
        conditions.push(
          sql`${contents.publishedAt} <= ${options.publishedBefore}`
        );
      }

      // Build the complete filter options
      const filterOptions: FilterOptions<Content> = {
        ...options,
      };

      if (conditions.length > 0) {
        (filterOptions as any).where = and(...conditions);
      }

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to search content",
          "searchContent",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Publish content
   */
  async publish(
    id: string,
    publishedAt?: Date
  ): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          status: "published",
          publishedAt: publishedAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "publish",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to publish content",
          "publish",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Unpublish content
   */
  async unpublish(id: string): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          status: "draft",
          publishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "unpublish",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to unpublish content",
          "unpublish",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Archive content
   */
  async archive(id: string): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "archive",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to archive content",
          "archive",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update content metadata
   */
  async updateMetadata(
    id: string,
    metadata: Record<string, unknown>
  ): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "updateMetadata",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update content metadata",
          "updateMetadata",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update content tags
   */
  async updateTags(
    id: string,
    tags: string[]
  ): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          tags,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "updateTags",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update content tags",
          "updateTags",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update content SEO data
   */
  async updateSeoData(
    id: string,
    seoData: Record<string, unknown>
  ): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          seoData,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "updateSeoData",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update content SEO data",
          "updateSeoData",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get content statistics by tenant
   */
  async getStatsByTenant(tenantId: string): Promise<
    Result<
      {
        total: number;
        published: number;
        draft: number;
        archived: number;
        scheduled: number;
      },
      Error
    >
  > {
    try {
      const [stats] = await this.db
        .select({
          total: sql<number>`count(*)`,
          published: sql<number>`count(case when status = 'published' then 1 end)`,
          draft: sql<number>`count(case when status = 'draft' then 1 end)`,
          archived: sql<number>`count(case when status = 'archived' then 1 end)`,
          scheduled: sql<number>`count(case when status = 'scheduled' then 1 end)`,
        })
        .from(this.table)
        .where(eq(contents.tenantId, tenantId));

      return {
        success: true,
        data: {
          total: stats?.total || 0,
          published: stats?.published || 0,
          draft: stats?.draft || 0,
          archived: stats?.archived || 0,
          scheduled: stats?.scheduled || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content statistics",
          "getStatsByTenant",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Check if slug is available within tenant
   */
  async isSlugAvailable(
    tenantId: string,
    slug: string,
    excludeId?: string
  ): Promise<Result<boolean, Error>> {
    try {
      const conditions = [
        eq(contents.tenantId, tenantId),
        eq(contents.slug, slug),
      ];

      if (excludeId) {
        conditions.push(sql`${contents.id} != ${excludeId}`);
      }

      const [existing] = await this.db
        .select({ id: contents.id })
        .from(this.table)
        .where(and(...conditions))
        .limit(1);

      return { success: true, data: !existing };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check slug availability",
          "isSlugAvailable",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get recent content by tenant
   */
  async getRecentContent(
    tenantId: string,
    limit: number = 10
  ): Promise<Result<Content[], Error>> {
    try {
      const recentContent = await this.db
        .select()
        .from(this.table)
        .where(eq(contents.tenantId, tenantId))
        .orderBy(desc(contents.updatedAt))
        .limit(limit);

      return { success: true, data: recentContent as Content[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get recent content",
          "getRecentContent",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get popular content by date (most recently published)
   */
  async getPopularContent(
    tenantId: string,
    limit: number = 10
  ): Promise<Result<Content[], Error>> {
    try {
      const popularContent = await this.db
        .select()
        .from(this.table)
        .where(
          and(eq(contents.tenantId, tenantId), eq(contents.status, "published"))
        )
        .orderBy(desc(contents.publishedAt))
        .limit(limit);

      return { success: true, data: popularContent as Content[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get popular content",
          "getPopularContent",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update content metadata for tracking (placeholder for view counting)
   */
  async updateContentMetrics(
    id: string,
    metrics: Record<string, unknown>
  ): Promise<Result<Content, Error>> {
    try {
      const [updatedContent] = await this.db
        .update(this.table)
        .set({
          metadata: sql`${contents.metadata} || ${JSON.stringify(metrics)}`,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, id))
        .returning();

      if (!updatedContent) {
        return {
          success: false,
          error: new DatabaseError(
            "Content not found",
            "updateContentMetrics",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedContent as Content };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update content metrics",
          "updateContentMetrics",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Create a new content version
   */
  async createVersion(versionData: {
    contentId: string;
    version: number;
    title: string;
    body: string | null;
    excerpt: string | null;
    status: string;
    authorId: string;
    changeLog?: string;
    customFields?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Result<ContentVersion, Error>> {
    try {
      const [version] = await this.db
        .insert(contentVersions)
        .values({
          contentId: versionData.contentId,
          version: versionData.version,
          title: versionData.title,
          body: versionData.body,
          excerpt: versionData.excerpt,
          status: versionData.status,
          authorId: versionData.authorId,
          changeLog: versionData.changeLog || null,
          customFields: versionData.customFields || null,
          metadata: versionData.metadata || null,
        })
        .returning();

      return { success: true, data: version as ContentVersion };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create content version",
          "createVersion",
          "content_versions",
          error
        ),
      };
    }
  }

  /**
   * Get all versions of a content item
   */
  async getVersions(
    contentId: string
  ): Promise<Result<ContentVersion[], Error>> {
    try {
      const versions = await this.db
        .select()
        .from(contentVersions)
        .where(eq(contentVersions.contentId, contentId))
        .orderBy(desc(contentVersions.version));

      return { success: true, data: versions as ContentVersion[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content versions",
          "getVersions",
          "content_versions",
          error
        ),
      };
    }
  }

  /**
   * Get a specific version of content
   */
  async getVersion(
    contentId: string,
    versionNumber: number
  ): Promise<Result<ContentVersion | null, Error>> {
    try {
      const [version] = await this.db
        .select()
        .from(contentVersions)
        .where(
          and(
            eq(contentVersions.contentId, contentId),
            eq(contentVersions.version, versionNumber)
          )
        )
        .limit(1);

      return { success: true, data: (version as ContentVersion) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content version",
          "getVersion",
          "content_versions",
          error
        ),
      };
    }
  }
}
