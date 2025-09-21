import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { injectable } from "tsyringe";
import { media } from "../database/schema/media.schema.ts";
import { DatabaseError } from "../errors/database.error.ts";
import type {
  FilterOptions,
  PaginatedResult,
} from "../types/database.types.ts";
import type { Result } from "../types/result.types.ts";
import { TenantBaseRepository } from "./tenant-base.repository.ts";

/**
 * Media entity type
 */
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

/**
 * Media-specific filter options
 */
export interface MediaFilterOptions extends FilterOptions<Media> {
  type?: string | string[];
  storageProvider?: string | string[];
  processingStatus?: string | string[];
  uploadedBy?: string;
  search?: string; // Search in originalName, title, description
  isPublic?: boolean;
  minSize?: number;
  maxSize?: number;
  mimeType?: string | string[];
  uploadedAfter?: Date;
  uploadedBefore?: Date;
}

/**
 * Media repository implementation
 * Handles all database operations for media files
 */
@injectable()
export class MediaRepository extends TenantBaseRepository<Media> {
  constructor() {
    super(media);
  }

  /**
   * Find media by filename
   */
  async findByFilename(
    tenantId: string,
    filename: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const [mediaFile] = await this.db
        .select()
        .from(this.table)
        .where(and(eq(media.tenantId, tenantId), eq(media.filename, filename)))
        .limit(1);

      return { success: true, data: (mediaFile as Media) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by filename",
          "findByFilename",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find media by hash (for duplicate detection)
   */
  async findByHash(
    tenantId: string,
    hash: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const [mediaFile] = await this.db
        .select()
        .from(this.table)
        .where(and(eq(media.tenantId, tenantId), eq(media.hash, hash)))
        .limit(1);

      return { success: true, data: (mediaFile as Media) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by hash",
          "findByHash",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find public media
   */
  async findPublicMedia(
    tenantId: string,
    options: FilterOptions<Media> = {}
  ): Promise<Result<PaginatedResult<Media>, Error>> {
    try {
      const filterOptions: FilterOptions<Media> = {
        ...options,
      };

      const conditions = [
        eq(media.tenantId, tenantId),
        eq(media.isPublic, true),
      ];

      (filterOptions as any).where = and(...conditions);

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find public media",
          "findPublicMedia",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find media by uploader
   */
  async findByUploader(
    tenantId: string,
    uploadedBy: string,
    options: FilterOptions<Media> = {}
  ): Promise<Result<PaginatedResult<Media>, Error>> {
    try {
      const filterOptions: FilterOptions<Media> = {
        ...options,
      };

      const conditions = [
        eq(media.tenantId, tenantId),
        eq(media.uploaderId, uploadedBy),
      ];

      (filterOptions as any).where = and(...conditions);

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find media by uploader",
          "findByUploader",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Search media with advanced filtering
   */
  async searchMedia(
    tenantId: string,
    options: MediaFilterOptions = {}
  ): Promise<Result<PaginatedResult<Media>, Error>> {
    try {
      const conditions = [eq(media.tenantId, tenantId)];

      // Add type filter
      if (options.type) {
        if (Array.isArray(options.type)) {
          conditions.push(
            or(...options.type.map((type) => eq(media.mediaType, type)))!
          );
        } else {
          conditions.push(eq(media.mediaType, options.type));
        }
      }

      // Add storage provider filter
      if (options.storageProvider) {
        if (Array.isArray(options.storageProvider)) {
          conditions.push(
            or(
              ...options.storageProvider.map((provider) =>
                eq(media.storageProvider, provider)
              )
            )!
          );
        } else {
          conditions.push(eq(media.storageProvider, options.storageProvider));
        }
      }

      // Add processing status filter
      if (options.processingStatus) {
        if (Array.isArray(options.processingStatus)) {
          conditions.push(
            or(
              ...options.processingStatus.map((status) =>
                eq(media.processingStatus, status)
              )
            )!
          );
        } else {
          conditions.push(eq(media.processingStatus, options.processingStatus));
        }
      }

      // Add uploader filter
      if (options.uploadedBy) {
        conditions.push(eq(media.uploaderId, options.uploadedBy));
      }

      // Add search filter
      if (options.search) {
        const searchTerm = `%${options.search}%`;
        conditions.push(
          or(
            ilike(media.originalName, searchTerm),
            ilike(media.description, searchTerm),
            ilike(media.alt, searchTerm)
          )!
        );
      }

      // Add public filter
      if (typeof options.isPublic === "boolean") {
        conditions.push(eq(media.isPublic, options.isPublic));
      }

      // Add size range filters
      if (options.minSize) {
        conditions.push(sql`${media.size} >= ${options.minSize}`);
      }

      if (options.maxSize) {
        conditions.push(sql`${media.size} <= ${options.maxSize}`);
      }

      // Add MIME type filter
      if (options.mimeType) {
        if (Array.isArray(options.mimeType)) {
          conditions.push(
            or(...options.mimeType.map((mime) => eq(media.mimeType, mime)))!
          );
        } else {
          conditions.push(eq(media.mimeType, options.mimeType));
        }
      }

      // Add date range filters
      if (options.uploadedAfter) {
        conditions.push(sql`${media.createdAt} >= ${options.uploadedAfter}`);
      }

      if (options.uploadedBefore) {
        conditions.push(sql`${media.createdAt} <= ${options.uploadedBefore}`);
      }

      // Build the complete filter options
      const filterOptions: FilterOptions<Media> = {
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
          "Failed to search media",
          "searchMedia",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(
    id: string,
    status: string,
    processedData?: Record<string, unknown>
  ): Promise<Result<Media, Error>> {
    try {
      const updateData: any = {
        processingStatus: status,
        updatedAt: new Date(),
      };

      if (processedData) {
        updateData.processedData = processedData;
      }

      const [updatedMedia] = await this.db
        .update(this.table)
        .set(updateData)
        .where(eq(media.id, id))
        .returning();

      if (!updatedMedia) {
        return {
          success: false,
          error: new DatabaseError(
            "Media not found",
            "updateProcessingStatus",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedMedia as Media };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update processing status",
          "updateProcessingStatus",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update media metadata
   */
  async updateMetadata(
    id: string,
    metadata: Record<string, unknown>
  ): Promise<Result<Media, Error>> {
    try {
      const [updatedMedia] = await this.db
        .update(this.table)
        .set({
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(media.id, id))
        .returning();

      if (!updatedMedia) {
        return {
          success: false,
          error: new DatabaseError(
            "Media not found",
            "updateMetadata",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedMedia as Media };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update media metadata",
          "updateMetadata",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Make media public
   */
  async makePublic(id: string): Promise<Result<Media, Error>> {
    try {
      const [updatedMedia] = await this.db
        .update(this.table)
        .set({
          isPublic: true,
          updatedAt: new Date(),
        })
        .where(eq(media.id, id))
        .returning();

      if (!updatedMedia) {
        return {
          success: false,
          error: new DatabaseError(
            "Media not found",
            "makePublic",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedMedia as Media };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to make media public",
          "makePublic",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Make media private
   */
  async makePrivate(id: string): Promise<Result<Media, Error>> {
    try {
      const [updatedMedia] = await this.db
        .update(this.table)
        .set({
          isPublic: false,
          updatedAt: new Date(),
        })
        .where(eq(media.id, id))
        .returning();

      if (!updatedMedia) {
        return {
          success: false,
          error: new DatabaseError(
            "Media not found",
            "makePrivate",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedMedia as Media };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to make media private",
          "makePrivate",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get media statistics by tenant
   */
  async getStatsByTenant(tenantId: string): Promise<
    Result<
      {
        total: number;
        totalSize: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
        public: number;
        private: number;
      },
      Error
    >
  > {
    try {
      const [stats] = await this.db
        .select({
          total: sql<number>`count(*)`,
          totalSize: sql<number>`sum(${media.size})`,
          public: sql<number>`count(case when ${media.isPublic} = true then 1 end)`,
          private: sql<number>`count(case when ${media.isPublic} = false then 1 end)`,
        })
        .from(this.table)
        .where(eq(media.tenantId, tenantId));

      // Get counts by type
      const typeStats = await this.db
        .select({
          type: media.mediaType,
          count: sql<number>`count(*)`,
        })
        .from(this.table)
        .where(eq(media.tenantId, tenantId))
        .groupBy(media.mediaType);

      // Get counts by processing status
      const statusStats = await this.db
        .select({
          status: media.processingStatus,
          count: sql<number>`count(*)`,
        })
        .from(this.table)
        .where(eq(media.tenantId, tenantId))
        .groupBy(media.processingStatus);

      const byType: Record<string, number> = {};
      typeStats.forEach((stat) => {
        if (stat.type) {
          byType[stat.type] = stat.count || 0;
        }
      });

      const byStatus: Record<string, number> = {};
      statusStats.forEach((stat) => {
        if (stat.status) {
          byStatus[stat.status] = stat.count || 0;
        }
      });

      return {
        success: true,
        data: {
          total: stats?.total || 0,
          totalSize: stats?.totalSize || 0,
          byType,
          byStatus,
          public: stats?.public || 0,
          private: stats?.private || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media statistics",
          "getStatsByTenant",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get recent media
   */
  async getRecentMedia(
    tenantId: string,
    limit: number = 10
  ): Promise<Result<Media[], Error>> {
    try {
      const recentMedia = await this.db
        .select()
        .from(this.table)
        .where(eq(media.tenantId, tenantId))
        .orderBy(desc(media.createdAt))
        .limit(limit);

      return { success: true, data: recentMedia as Media[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get recent media",
          "getRecentMedia",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get media by content (for content that references media)
   */
  async getMediaByContent(
    tenantId: string,
    contentId: string
  ): Promise<Result<Media[], Error>> {
    try {
      // This would typically involve a junction table or JSON field lookup
      // For now, assuming media has a contentIds field that's a JSON array
      const mediaFiles = await this.db
        .select()
        .from(this.table)
        .where(
          and(
            eq(media.tenantId, tenantId),
            sql`${media.metadata}->>'contentIds' @> ${JSON.stringify([
              contentId,
            ])}`
          )
        );

      return { success: true, data: mediaFiles as Media[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media by content",
          "getMediaByContent",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update download metrics (using metadata for tracking)
   */
  async updateDownloadMetrics(id: string): Promise<Result<Media, Error>> {
    try {
      const [updatedMedia] = await this.db
        .update(this.table)
        .set({
          metadata: sql`${media.metadata} || '{"downloads": COALESCE((${media.metadata}->>'downloads')::int, 0) + 1}'::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(media.id, id))
        .returning();

      if (!updatedMedia) {
        return {
          success: false,
          error: new DatabaseError(
            "Media not found",
            "updateDownloadMetrics",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedMedia as Media };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update download metrics",
          "updateDownloadMetrics",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get orphaned media (media not referenced by any content)
   */
  async getOrphanedMedia(tenantId: string): Promise<Result<Media[], Error>> {
    try {
      // This is a simplified approach - in practice you'd need to check
      // against actual content references
      const orphanedMedia = await this.db
        .select()
        .from(this.table)
        .where(
          and(
            eq(media.tenantId, tenantId),
            sql`(${media.metadata}->>'contentIds' IS NULL OR ${media.metadata}->>'contentIds' = '[]')`
          )
        );

      return { success: true, data: orphanedMedia as Media[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get orphaned media",
          "getOrphanedMedia",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Check if filename is available within tenant
   */
  async isFilenameAvailable(
    tenantId: string,
    filename: string,
    excludeId?: string
  ): Promise<Result<boolean, Error>> {
    try {
      const conditions = [
        eq(media.tenantId, tenantId),
        eq(media.filename, filename),
      ];

      if (excludeId) {
        conditions.push(sql`${media.id} != ${excludeId}`);
      }

      const [existing] = await this.db
        .select({ id: media.id })
        .from(this.table)
        .where(and(...conditions))
        .limit(1);

      return { success: true, data: !existing };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check filename availability",
          "isFilenameAvailable",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Cleanup failed uploads (processing status = failed and old)
   */
  async cleanupFailedUploads(
    tenantId: string,
    olderThanHours: number = 24
  ): Promise<Result<number, Error>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

      const deleted = await this.db
        .delete(this.table)
        .where(
          and(
            eq(media.tenantId, tenantId),
            eq(media.processingStatus, "failed"),
            sql`${media.createdAt} < ${cutoffDate}`
          )
        );

      return { success: true, data: (deleted as any).rowCount || 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to cleanup failed uploads",
          "cleanupFailedUploads",
          this.table._.name,
          error
        ),
      };
    }
  }
}
