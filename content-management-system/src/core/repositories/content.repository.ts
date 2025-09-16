import { eq, and, ilike, or, desc, count } from "drizzle-orm";
import { injectable } from "tsyringe";
import { TenantBaseRepository } from "./tenant-base.repository.js";
import { contents, contentVersions, users } from "../database/schema/index.js";
import type {
  Content,
  ContentVersion,
  NewContentVersion,
  ContentStatus,
  User,
} from "../database/schema/index.js";
import type { Result } from "../types/result.types.js";
import type { FilterOptions } from "../types/database.types.js";
import { DatabaseError } from "../errors/database.error.js";
import { NotFoundError } from "../errors/not-found.error.js";

/**
 * Content repository with versioning and publishing methods
 */
@injectable()
export class ContentRepository extends TenantBaseRepository<Content> {
  constructor() {
    super(contents);
  }

  /**
   * Find content by slug within tenant
   */
  async findBySlugInTenant(
    slug: string,
    tenantId: string
  ): Promise<Result<Content | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(contents)
        .where(and(eq(contents.slug, slug), eq(contents.tenantId, tenantId)))
        .limit(1);

      return {
        success: true,
        data: result[0] ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find content by slug",
          "findBySlug",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Find content by ID within tenant
   */
  override async findByIdInTenant(
    id: string,
    tenantId: string
  ): Promise<Result<Content | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(contents)
        .where(and(eq(contents.id, id), eq(contents.tenantId, tenantId)))
        .limit(1);

      return {
        success: true,
        data: result[0] ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find content by ID in tenant",
          "findByIdInTenant",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Find published content only
   */
  async findPublished(
    tenantId?: string,
    options?: FilterOptions<Content>
  ): Promise<Result<Content[], Error>> {
    try {
      const publishedFilter = {
        ...options,
        where: {
          ...options?.where,
          status: "published" as ContentStatus,
          ...(tenantId && { tenantId }),
        },
      };

      return await this.findMany(publishedFilter);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find published content",
          "findPublished",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Find draft content by author
   */
  async findDraftsByAuthor(
    authorId: string,
    tenantId?: string
  ): Promise<Result<Content[], Error>> {
    try {
      const whereConditions = tenantId
        ? and(
            eq(contents.authorId, authorId),
            eq(contents.status, "draft"),
            eq(contents.tenantId, tenantId)
          )
        : and(eq(contents.authorId, authorId), eq(contents.status, "draft"));

      const result = await this.db
        .select()
        .from(contents)
        .where(whereConditions)
        .orderBy(desc(contents.updatedAt));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find drafts by author",
          "findDraftsByAuthor",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Search content by title and body
   */
  async searchContent(
    query: string,
    tenantId?: string,
    status?: ContentStatus,
    limit = 20
  ): Promise<Result<Content[], Error>> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;

      // Build the search condition
      const searchConditions = or(
        ilike(contents.title, searchPattern),
        ilike(contents.body, searchPattern),
        ilike(contents.excerpt, searchPattern)
      );

      // Build the where condition based on filters
      let whereConditions = searchConditions;

      if (tenantId && status) {
        whereConditions = and(
          eq(contents.tenantId, tenantId),
          eq(contents.status, status),
          searchConditions
        );
      } else if (tenantId) {
        whereConditions = and(eq(contents.tenantId, tenantId), searchConditions);
      } else if (status) {
        whereConditions = and(eq(contents.status, status), searchConditions);
      }

      const result = await this.db
        .select()
        .from(contents)
        .where(whereConditions)
        .limit(limit)
        .orderBy(desc(contents.updatedAt));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to search content",
          "searchContent",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Find content by tags
   */
  async findByTags(
    tags: string[],
    tenantId?: string,
    status?: ContentStatus
  ): Promise<Result<Content[], Error>> {
    try {
      // Build where conditions
      let whereConditions;

      if (tenantId && status) {
        whereConditions = and(
          eq(contents.tenantId, tenantId),
          eq(contents.status, status)
        );
      } else if (tenantId) {
        whereConditions = eq(contents.tenantId, tenantId);
      } else if (status) {
        whereConditions = eq(contents.status, status);
      }

      let query = this.db
        .select()
        .from(contents)
        .orderBy(desc(contents.updatedAt));

      if (whereConditions) {
        query = query.where(whereConditions);
      }

      const result = await query;

      // Filter by tags in application code (could be optimized with proper JSONB queries)
      const filteredResult = result.filter(
        (content) =>
          content.tags && content.tags.some((tag) => tags.includes(tag))
      );

      return { success: true, data: filteredResult };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find content by tags",
          "findByTags",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Publish content
   */
  async publishContent(contentId: string): Promise<Result<Content, Error>> {
    try {
      const [result] = await this.db
        .update(contents)
        .set({
          status: "published",
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contents.id, contentId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Content not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to publish content",
          "publishContent",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Unpublish content (set to draft)
   */
  async unpublishContent(contentId: string): Promise<Result<Content, Error>> {
    try {
      const [result] = await this.db
        .update(contents)
        .set({
          status: "draft",
          publishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, contentId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Content not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to unpublish content",
          "unpublishContent",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Archive content
   */
  async archiveContent(contentId: string): Promise<Result<Content, Error>> {
    try {
      const [result] = await this.db
        .update(contents)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(contents.id, contentId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Content not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to archive content",
          "archiveContent",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Create content version
   */
  async createVersion(
    versionData: NewContentVersion
  ): Promise<Result<ContentVersion, Error>> {
    try {
      const [result] = await this.db
        .insert(contentVersions)
        .values(versionData)
        .returning();

      if (!result) {
        return {
          success: false,
          error: new DatabaseError(
            "Failed to create content version - no result returned",
            "createVersion",
            "contentVersions",
            new Error("No result returned from insert")
          ),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create content version",
          "createVersion",
          "contentVersions",
          error
        ),
      };
    }
  }

  /**
   * Get content versions
   */
  async getVersions(
    contentId: string
  ): Promise<Result<ContentVersion[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(contentVersions)
        .where(eq(contentVersions.contentId, contentId))
        .orderBy(desc(contentVersions.version));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content versions",
          "getVersions",
          "contentVersions",
          error
        ),
      };
    }
  }

  /**
   * Get specific content version
   */
  async getVersion(
    contentId: string,
    version: number
  ): Promise<Result<ContentVersion | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(contentVersions)
        .where(
          and(
            eq(contentVersions.contentId, contentId),
            eq(contentVersions.version, version)
          )
        )
        .limit(1);

      return {
        success: true,
        data: result[0] ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content version",
          "getVersion",
          "contentVersions",
          error
        ),
      };
    }
  }

  /**
   * Get content with author information
   */
  async findWithAuthor(contentId: string): Promise<
    Result<
      {
        content: Content;
        author: User;
      } | null,
      Error
    >
  > {
    try {
      const result = await this.db
        .select({
          content: contents,
          author: users,
        })
        .from(contents)
        .leftJoin(users, eq(contents.authorId, users.id))
        .where(eq(contents.id, contentId))
        .limit(1);

      if (result.length === 0 || !result[0]?.author) {
        return { success: true, data: null };
      }

      const firstResult = result[0];
      if (!firstResult || !firstResult.author) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          content: firstResult.content,
          author: firstResult.author,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find content with author",
          "findWithAuthor",
          "contents",
          error
        ),
      };
    }
  }

  /**
   * Get content statistics for tenant
   */
  async getContentStats(tenantId: string): Promise<
    Result<
      {
        total: number;
        published: number;
        draft: number;
        archived: number;
      },
      Error
    >
  > {
    try {
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(contents)
        .where(eq(contents.tenantId, tenantId));

      const [publishedResult] = await this.db
        .select({ count: count() })
        .from(contents)
        .where(
          and(eq(contents.tenantId, tenantId), eq(contents.status, "published"))
        );

      const [draftResult] = await this.db
        .select({ count: count() })
        .from(contents)
        .where(
          and(eq(contents.tenantId, tenantId), eq(contents.status, "draft"))
        );

      const [archivedResult] = await this.db
        .select({ count: count() })
        .from(contents)
        .where(
          and(eq(contents.tenantId, tenantId), eq(contents.status, "archived"))
        );

      return {
        success: true,
        data: {
          total: totalResult?.count ?? 0,
          published: publishedResult?.count ?? 0,
          draft: draftResult?.count ?? 0,
          archived: archivedResult?.count ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content statistics",
          "getContentStats",
          "contents",
          error
        ),
      };
    }
  }
}
