import { eq, and, ilike, or, desc, count } from "drizzle-orm";
import { injectable } from "tsyringe";
import { TenantBaseRepository } from "./tenant-base.repository.js";
import {
  media,
  mediaFolders,
  mediaTransformations,
  mediaUsage,
} from "../database/schema/index.js";
import type {
  Media,
  MediaFolder,
  NewMediaFolder,
  MediaTransformation,
  MediaUsage,
  MediaType,
} from "../database/schema/index.js";
import type { Result } from "../types/result.types.js";
import { DatabaseError } from "../errors/database.error.js";

/**
 * Media repository with file management and transformation methods
 */
@injectable()
export class MediaRepository extends TenantBaseRepository<Media> {
  constructor() {
    super(media);
  }

  /**
   * Find media by hash within tenant
   */
  async findByHash(
    hash: string,
    tenantId: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(media)
        .where(and(eq(media.hash, hash), eq(media.tenantId, tenantId)))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by hash",
          "findByHash",
          "media",
          error
        ),
      };
    }
  }

  /**
   * Find media by ID within tenant
   */
  override async findByIdInTenant(
    id: string,
    tenantId: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(media)
        .where(and(eq(media.id, id), eq(media.tenantId, tenantId)))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by ID in tenant",
          "findByIdInTenant",
          "media",
          error
        ),
      };
    }
  }

  /**
   * Find media by folder
   */
  async findByFolder(
    folderId: string,
    tenantId: string
  ): Promise<Result<Media[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(media)
        .where(and(eq(media.folderId, folderId), eq(media.tenantId, tenantId)))
        .orderBy(desc(media.createdAt));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by folder",
          "findByFolder",
          "media",
          error
        ),
      };
    }
  }

  /**
   * Find media by type
   */
  async findByType(
    mediaType: MediaType,
    tenantId: string,
    limit = 50
  ): Promise<Result<Media[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(media)
        .where(
          and(eq(media.mediaType, mediaType), eq(media.tenantId, tenantId))
        )
        .orderBy(desc(media.createdAt))
        .limit(limit);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by type",
          "findByType",
          "media",
          error
        ),
      };
    }
  }

  /**
   * Search media by filename and metadata
   */
  async searchMedia(
    query: string,
    tenantId: string,
    mediaType?: MediaType,
    limit = 20
  ): Promise<Result<Media[], Error>> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;

      let dbQuery = this.db
        .select()
        .from(media)
        .where(
          and(
            eq(media.tenantId, tenantId),
            or(
              ilike(media.filename, searchPattern),
              ilike(media.originalName, searchPattern),
              ilike(media.alt, searchPattern),
              ilike(media.caption, searchPattern),
              ilike(media.description, searchPattern)
            )
          )
        )
        .limit(limit)
        .orderBy(desc(media.createdAt));

      if (mediaType) {
        dbQuery = dbQuery.where(
          and(
            eq(media.tenantId, tenantId),
            eq(media.mediaType, mediaType),
            or(
              ilike(media.filename, searchPattern),
              ilike(media.originalName, searchPattern),
              ilike(media.alt, searchPattern),
              ilike(media.caption, searchPattern),
              ilike(media.description, searchPattern)
            )
          )
        ) as typeof dbQuery;
      }

      const result = await dbQuery;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to search media",
          "searchMedia",
          "media",
          error
        ),
      };
    }
  }

  /**
   * Find public media
   */
  async findPublicMedia(
    tenantId?: string,
    mediaType?: MediaType,
    limit = 50
  ): Promise<Result<Media[], Error>> {
    try {
      let query = this.db
        .select()
        .from(media)
        .where(eq(media.isPublic, true))
        .orderBy(desc(media.createdAt))
        .limit(limit);

      if (tenantId) {
        query = query.where(
          and(eq(media.isPublic, true), eq(media.tenantId, tenantId))
        ) as typeof query;
      }

      if (mediaType) {
        const existingWhere = tenantId
          ? and(
              eq(media.isPublic, true),
              eq(media.tenantId, tenantId),
              eq(media.mediaType, mediaType)
            )
          : and(eq(media.isPublic, true), eq(media.mediaType, mediaType));

        query = query.where(existingWhere) as typeof query;
      }

      const result = await query;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find public media",
          "findPublicMedia",
          "media",
          error
        ),
      };
    }
  }

  /**
   * Get media usage
   */
  async getUsage(mediaId: string): Promise<Result<MediaUsage[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(mediaUsage)
        .where(eq(mediaUsage.mediaId, mediaId));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media usage",
          "getUsage",
          "mediaUsage",
          error
        ),
      };
    }
  }

  /**
   * Track media usage
   */
  async trackUsage(
    mediaId: string,
    entityType: string,
    entityId: string,
    field?: string,
    context?: Record<string, unknown>
  ): Promise<Result<MediaUsage, Error>> {
    try {
      const insertData: any = {
        mediaId,
        entityType,
        entityId,
      };

      if (field !== undefined) insertData.field = field;
      if (context !== undefined) insertData.context = context;

      const [result] = await this.db
        .insert(mediaUsage)
        .values(insertData)
        .returning();

      return { success: true, data: result! };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to track media usage",
          "trackUsage",
          "mediaUsage",
          error
        ),
      };
    }
  }

  /**
   * Remove media usage tracking
   */
  async removeUsage(
    mediaId: string,
    entityType: string,
    entityId: string
  ): Promise<Result<void, Error>> {
    try {
      await this.db
        .delete(mediaUsage)
        .where(
          and(
            eq(mediaUsage.mediaId, mediaId),
            eq(mediaUsage.entityType, entityType),
            eq(mediaUsage.entityId, entityId)
          )
        );

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to remove media usage",
          "removeUsage",
          "mediaUsage",
          error
        ),
      };
    }
  }

  /**
   * Get media transformations
   */
  async getTransformations(
    mediaId: string
  ): Promise<Result<MediaTransformation[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(mediaTransformations)
        .where(eq(mediaTransformations.mediaId, mediaId))
        .orderBy(mediaTransformations.name);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media transformations",
          "getTransformations",
          "mediaTransformations",
          error
        ),
      };
    }
  }

  /**
   * Create media transformation
   */
  async createTransformation(transformationData: {
    mediaId: string;
    name: string;
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
    size: number;
    path: string;
    url?: string;
    cdnUrl?: string;
    transformations?: Record<string, unknown>;
  }): Promise<Result<MediaTransformation, Error>> {
    try {
      const [result] = await this.db
        .insert(mediaTransformations)
        .values(transformationData)
        .returning();

      return { success: true, data: result! };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create media transformation",
          "createTransformation",
          "mediaTransformations",
          error
        ),
      };
    }
  }

  /**
   * Delete media transformations
   */
  async deleteTransformations(mediaId: string): Promise<Result<void, Error>> {
    try {
      await this.db
        .delete(mediaTransformations)
        .where(eq(mediaTransformations.mediaId, mediaId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to delete media transformations",
          "deleteTransformations",
          "mediaTransformations",
          error
        ),
      };
    }
  }

  /**
   * Create media folder
   */
  async createFolder(
    folderData: NewMediaFolder
  ): Promise<Result<MediaFolder, Error>> {
    try {
      const [result] = await this.db
        .insert(mediaFolders)
        .values(folderData)
        .returning();

      return { success: true, data: result! };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create media folder",
          "createFolder",
          "mediaFolders",
          error
        ),
      };
    }
  }

  /**
   * Get media folder
   */
  async getFolder(
    folderId: string
  ): Promise<Result<MediaFolder | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(mediaFolders)
        .where(eq(mediaFolders.id, folderId))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media folder",
          "getFolder",
          "mediaFolders",
          error
        ),
      };
    }
  }

  /**
   * Find folder by slug
   */
  async findFolderBySlug(
    slug: string,
    tenantId: string,
    parentId?: string
  ): Promise<Result<MediaFolder | null, Error>> {
    try {
      let query = this.db
        .select()
        .from(mediaFolders)
        .where(
          and(eq(mediaFolders.slug, slug), eq(mediaFolders.tenantId, tenantId))
        );

      if (parentId) {
        query = query.where(
          and(
            eq(mediaFolders.slug, slug),
            eq(mediaFolders.tenantId, tenantId),
            eq(mediaFolders.parentId, parentId)
          )
        ) as typeof query;
      } else {
        query = query.where(
          and(
            eq(mediaFolders.slug, slug),
            eq(mediaFolders.tenantId, tenantId),
            eq(mediaFolders.parentId, null as any)
          )
        ) as typeof query;
      }

      const result = await query.limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find folder by slug",
          "findFolderBySlug",
          "mediaFolders",
          error
        ),
      };
    }
  }

  /**
   * Get folder children
   */
  async getFolderChildren(
    parentId: string,
    tenantId: string
  ): Promise<Result<MediaFolder[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(mediaFolders)
        .where(
          and(
            eq(mediaFolders.parentId, parentId),
            eq(mediaFolders.tenantId, tenantId)
          )
        )
        .orderBy(mediaFolders.sortOrder, mediaFolders.name);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get folder children",
          "getFolderChildren",
          "mediaFolders",
          error
        ),
      };
    }
  }

  /**
   * Check if folder exists
   */
  async folderExists(
    folderId: string,
    tenantId: string
  ): Promise<Result<boolean, Error>> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(mediaFolders)
        .where(
          and(
            eq(mediaFolders.id, folderId),
            eq(mediaFolders.tenantId, tenantId)
          )
        );

      return { success: true, data: (result[0]?.count ?? 0) > 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check folder existence",
          "folderExists",
          "mediaFolders",
          error
        ),
      };
    }
  }

  /**
   * Get media statistics for tenant
   */
  async getMediaStats(tenantId: string): Promise<
    Result<
      {
        total: number;
        byType: Record<MediaType, number>;
        totalSize: number;
        publicCount: number;
      },
      Error
    >
  > {
    try {
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(media)
        .where(eq(media.tenantId, tenantId));

      const [publicResult] = await this.db
        .select({ count: count() })
        .from(media)
        .where(and(eq(media.tenantId, tenantId), eq(media.isPublic, true)));

      // Get counts by type
      const typeResults = await this.db
        .select({
          mediaType: media.mediaType,
          count: count(),
        })
        .from(media)
        .where(eq(media.tenantId, tenantId))
        .groupBy(media.mediaType);

      const byType: Record<string, number> = {};
      for (const result of typeResults) {
        byType[result.mediaType] = result.count;
      }

      // Calculate total size (would need to sum the size column)
      // This is a simplified version
      const totalSize = 0; // TODO: Implement actual size calculation

      return {
        success: true,
        data: {
          total: totalResult?.count ?? 0,
          byType: byType as Record<MediaType, number>,
          totalSize,
          publicCount: publicResult?.count ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media statistics",
          "getMediaStats",
          "media",
          error
        ),
      };
    }
  }
}
