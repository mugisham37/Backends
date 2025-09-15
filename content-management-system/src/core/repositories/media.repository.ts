import { eq, and, ilike, or, desc, gte, lte } from "drizzle-orm";
import { injectable } from "tsyringe";
import { TenantBaseRepository } from "./tenant-base.repository.js";
import { media, users } from "../database/schema/index.js";
import type {
  Media,
  NewMedia,
  User,
  MediaType,
  ProcessingStatus,
} from "../database/schema/index.js";
import type { Result } from "../types/result.types.js";
import type { FilterOptions } from "../types/database.types.js";
import { DatabaseError } from "../errors/database.error.js";
import { NotFoundError } from "../errors/not-found.error.js";

/**
 * Media repository with file management and processing methods
 */
@injectable()
export class MediaRepository extends TenantBaseRepository<Media> {
  constructor() {
    super(media);
  }

  /**
   * Find media by filename within tenant
   */
  async findByFilename(
    filename: string,
    tenantId: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(media)
        .where(and(eq(media.filename, filename), eq(media.tenantId, tenantId)))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media by filename", error),
      };
    }
  }

  /**
   * Find media by type
   */
  async findByType(
    type: MediaType,
    tenantId?: string,
    limit = 50
  ): Promise<Result<Media[], Error>> {
    try {
      let query = this.db
        .select()
        .from(media)
        .where(eq(media.mediaType, type))
        .limit(limit)
        .orderBy(desc(media.createdAt));

      if (tenantId) {
        query = query.where(
          and(eq(media.mediaType, type), eq(media.tenantId, tenantId))
        );
      }

      const result = await query;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media by type", error),
      };
    }
  }

  /**
   * Find media by MIME type
   */
  async findByMimeType(
    mimeType: string,
    tenantId?: string,
    limit = 50
  ): Promise<Result<Media[], Error>> {
    try {
      let query = this.db
        .select()
        .from(media)
        .where(eq(media.mimeType, mimeType))
        .limit(limit)
        .orderBy(desc(media.createdAt));

      if (tenantId) {
        query = query.where(
          and(eq(media.mimeType, mimeType), eq(media.tenantId, tenantId))
        );
      }

      const result = await query;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media by MIME type", error),
      };
    }
  }

  /**
   * Search media by filename or alt text
   */
  async searchMedia(
    query: string,
    tenantId?: string,
    type?: MediaType,
    limit = 20
  ): Promise<Result<Media[], Error>> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;

      let dbQuery = this.db
        .select()
        .from(media)
        .where(
          or(
            ilike(media.filename, searchPattern),
            ilike(media.originalName, searchPattern),
            ilike(media.alt, searchPattern),
            ilike(media.caption, searchPattern)
          )
        )
        .limit(limit)
        .orderBy(desc(media.createdAt));

      if (tenantId) {
        dbQuery = dbQuery.where(
          and(
            eq(media.tenantId, tenantId),
            or(
              ilike(media.filename, searchPattern),
              ilike(media.originalName, searchPattern),
              ilike(media.alt, searchPattern),
              ilike(media.caption, searchPattern)
            )
          )
        );
      }

      if (type) {
        const existingWhere = tenantId
          ? and(
              eq(media.tenantId, tenantId),
              eq(media.mediaType, type),
              or(
                ilike(media.filename, searchPattern),
                ilike(media.originalName, searchPattern),
                ilike(media.alt, searchPattern),
                ilike(media.caption, searchPattern)
              )
            )
          : and(
              eq(media.mediaType, type),
              or(
                ilike(media.filename, searchPattern),
                ilike(media.originalName, searchPattern),
                ilike(media.alt, searchPattern),
                ilike(media.caption, searchPattern)
              )
            );

        dbQuery = dbQuery.where(existingWhere);
      }

      const result = await dbQuery;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to search media", error),
      };
    }
  }

  /**
   * Find media by tags
   */
  async findByTags(
    tags: string[],
    tenantId?: string,
    type?: MediaType
  ): Promise<Result<Media[], Error>> {
    try {
      let query = this.db.select().from(media).orderBy(desc(media.createdAt));

      if (tenantId) {
        query = query.where(eq(media.tenantId, tenantId));
      }

      if (type) {
        const existingWhere = tenantId
          ? and(eq(media.tenantId, tenantId), eq(media.mediaType, type))
          : eq(media.mediaType, type);

        query = query.where(existingWhere);
      }

      const result = await query;

      // Filter by tags in application code
      const filteredResult = result.filter(
        (mediaItem) =>
          mediaItem.tags && mediaItem.tags.some((tag) => tags.includes(tag))
      );

      return { success: true, data: filteredResult };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media by tags", error),
      };
    }
  }

  /**
   * Find media by size range
   */
  async findBySizeRange(
    minSize: number,
    maxSize: number,
    tenantId?: string,
    type?: MediaType
  ): Promise<Result<Media[], Error>> {
    try {
      let query = this.db
        .select()
        .from(media)
        .where(and(gte(media.size, minSize), lte(media.size, maxSize)))
        .orderBy(desc(media.createdAt));

      if (tenantId) {
        query = query.where(
          and(
            eq(media.tenantId, tenantId),
            gte(media.size, minSize),
            lte(media.size, maxSize)
          )
        );
      }

      if (type) {
        const existingWhere = tenantId
          ? and(
              eq(media.tenantId, tenantId),
              eq(media.mediaType, type),
              gte(media.size, minSize),
              lte(media.size, maxSize)
            )
          : and(
              eq(media.mediaType, type),
              gte(media.size, minSize),
              lte(media.size, maxSize)
            );

        query = query.where(existingWhere);
      }

      const result = await query;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media by size range", error),
      };
    }
  }

  /**
   * Find media by uploader
   */
  async findByUploader(
    uploaderId: string,
    tenantId?: string,
    type?: MediaType
  ): Promise<Result<Media[], Error>> {
    try {
      let query = this.db
        .select()
        .from(media)
        .where(eq(media.uploaderId, uploaderId))
        .orderBy(desc(media.createdAt));

      if (tenantId) {
        query = query.where(
          and(eq(media.uploaderId, uploaderId), eq(media.tenantId, tenantId))
        );
      }

      if (type) {
        const existingWhere = tenantId
          ? and(
              eq(media.uploaderId, uploaderId),
              eq(media.tenantId, tenantId),
              eq(media.mediaType, type)
            )
          : and(eq(media.uploaderId, uploaderId), eq(media.mediaType, type));

        query = query.where(existingWhere);
      }

      const result = await query;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media by uploader", error),
      };
    }
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(
    mediaId: string,
    status: ProcessingStatus,
    processingMetadata?: Record<string, unknown>
  ): Promise<Result<Media, Error>> {
    try {
      const updateData: any = {
        processingStatus: status,
        updatedAt: new Date(),
      };

      if (processingMetadata) {
        updateData.metadata = processingMetadata;
      }

      const [result] = await this.db
        .update(media)
        .set(updateData)
        .where(eq(media.id, mediaId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Media not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to update processing status", error),
      };
    }
  }

  /**
   * Update CDN URLs
   */
  async updateCdnUrls(
    mediaId: string,
    url: string,
    cdnUrl?: string
  ): Promise<Result<Media, Error>> {
    try {
      const updateData: any = {
        url,
        updatedAt: new Date(),
      };

      if (cdnUrl) {
        updateData.cdnUrl = cdnUrl;
      }

      const [result] = await this.db
        .update(media)
        .set(updateData)
        .where(eq(media.id, mediaId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Media not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to update CDN URLs", error),
      };
    }
  }

  /**
   * Get media with uploader information
   */
  async findWithUploader(mediaId: string): Promise<
    Result<
      {
        media: Media;
        uploader: User;
      } | null,
      Error
    >
  > {
    try {
      const result = await this.db
        .select({
          media: media,
          uploader: users,
        })
        .from(media)
        .leftJoin(users, eq(media.uploaderId, users.id))
        .where(eq(media.id, mediaId))
        .limit(1);

      if (result.length === 0 || !result[0].uploader) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          media: result[0].media,
          uploader: result[0].uploader,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find media with uploader", error),
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
        totalSize: number;
        byType: Record<MediaType, number>;
        byStatus: Record<ProcessingStatus, number>;
      },
      Error
    >
  > {
    try {
      const allMedia = await this.db
        .select()
        .from(media)
        .where(eq(media.tenantId, tenantId));

      const total = allMedia.length;
      const totalSize = allMedia.reduce((sum, item) => sum + item.size, 0);

      const byType = allMedia.reduce((acc, item) => {
        acc[item.mediaType] = (acc[item.mediaType] || 0) + 1;
        return acc;
      }, {} as Record<MediaType, number>);

      const byStatus = allMedia.reduce((acc, item) => {
        acc[item.processingStatus] = (acc[item.processingStatus] || 0) + 1;
        return acc;
      }, {} as Record<ProcessingStatus, number>);

      return {
        success: true,
        data: {
          total,
          totalSize,
          byType,
          byStatus,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get media statistics", error),
      };
    }
  }

  /**
   * Get recently uploaded media
   */
  async getRecentMedia(
    tenantId: string,
    limit = 10
  ): Promise<Result<Media[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(media)
        .where(eq(media.tenantId, tenantId))
        .orderBy(desc(media.createdAt))
        .limit(limit);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get recent media", error),
      };
    }
  }
}
