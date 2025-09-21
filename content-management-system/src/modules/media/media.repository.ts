import { inject, injectable } from "tsyringe";
import type {
  Media,
  MediaFolder,
  MediaTransformation,
  NewMedia,
} from "../../core/database/schema/media.schema";
import { MediaRepository as CoreMediaRepository } from "../../core/repositories/media.repository";
import type { PaginatedResult } from "../../core/types/database.types";
import type { Result } from "../../core/types/result.types";

/**
 * Media repository service wrapper
 * Wraps the core media repository with additional business logic
 */
@injectable()
export class MediaRepository {
  constructor(
    @inject("CoreMediaRepository") private _coreRepository: CoreMediaRepository
  ) {}

  /**
   * Create a new media record
   */
  async create(data: NewMedia): Promise<Result<Media, Error>> {
    try {
      // Ensure all required fields are properly set with null for missing optional fields
      const mediaData = {
        ...data,
        width: data.width ?? null,
        height: data.height ?? null,
        duration: data.duration ?? null,
        hash: data.hash ?? null,
        url: data.url ?? null,
        cdnUrl: data.cdnUrl ?? null,
        bucket: data.bucket ?? null,
        key: data.key ?? null,
        alt: data.alt ?? null,
        caption: data.caption ?? null,
        description: data.description ?? null,
        tags: data.tags ?? null,
        exifData: data.exifData ?? null,
        metadata: data.metadata ?? null,
      };

      const result = await this._coreRepository.create(mediaData as any);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to create media"),
      };
    }
  }

  /**
   * Find media by hash for deduplication
   */
  async findByHash(
    hash: string,
    tenantId: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const result = await this._coreRepository.findByHash(tenantId, hash);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to find media by hash"),
      };
    }
  }

  /**
   * Find media by ID within tenant
   */
  async findByIdInTenant(
    id: string,
    tenantId: string
  ): Promise<Result<Media | null, Error>> {
    try {
      const result = await this._coreRepository.findByIdInTenant(id, tenantId);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to find media"),
      };
    }
  }

  /**
   * Find many media with pagination
   */
  async findManyPaginated(options: {
    where?: any;
    orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
    pagination: { page: number; limit: number };
  }): Promise<Result<PaginatedResult<Media>, Error>> {
    try {
      const result = await this._coreRepository.findManyPaginated({
        where: options.where,
        pagination: {
          page: options.pagination.page,
          limit: options.pagination.limit,
        },
        orderBy: options.orderBy,
      } as any);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to find media"),
      };
    }
  }

  /**
   * Update media
   */
  async update(
    id: string,
    data: Partial<Media>
  ): Promise<Result<Media, Error>> {
    try {
      const result = await this._coreRepository.update(id, data);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to update media"),
      };
    }
  }

  /**
   * Delete media
   */
  async delete(id: string): Promise<Result<void, Error>> {
    try {
      const result = await this._coreRepository.delete(id);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to delete media"),
      };
    }
  }

  /**
   * Check if folder exists
   */
  async folderExists(
    _folderId: string,
    _tenantId: string
  ): Promise<Result<boolean, Error>> {
    try {
      // This would need to be implemented in the core repository
      // For now, return true as placeholder
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to check folder"),
      };
    }
  }

  /**
   * Get media usage (where it's being used)
   */
  async getUsage(
    _mediaId: string
  ): Promise<Result<Array<{ type: string; id: string }>, Error>> {
    try {
      // This would need to be implemented in the core repository
      // For now, return empty array as placeholder
      return { success: true, data: [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to get media usage"),
      };
    }
  }

  /**
   * Get media transformations
   */
  async getTransformations(
    _mediaId: string
  ): Promise<Result<MediaTransformation[], Error>> {
    try {
      // This would need to be implemented in the core repository
      // For now, return empty array as placeholder
      return { success: true, data: [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to get transformations"),
      };
    }
  }

  /**
   * Create media folder
   */
  async createFolder(data: {
    name: string;
    slug: string;
    description?: string;
    parentId?: string;
    tenantId: string;
    path: string;
    isPublic: boolean;
  }): Promise<Result<MediaFolder, Error>> {
    try {
      // This would need to be implemented in the core repository
      // For now, create a placeholder folder object
      const folder: MediaFolder = {
        id: crypto.randomUUID(),
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        parentId: data.parentId ?? null,
        tenantId: data.tenantId,
        path: data.path,
        isPublic: data.isPublic,
        metadata: null,
        sortOrder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { success: true, data: folder };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to create folder"),
      };
    }
  }

  /**
   * Find folder by slug
   */
  async findFolderBySlug(
    _slug: string,
    _tenantId: string,
    _parentId?: string
  ): Promise<Result<MediaFolder | null, Error>> {
    try {
      // This would need to be implemented in the core repository
      // For now, return null (no existing folder)
      return { success: true, data: null };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to find folder"),
      };
    }
  }

  /**
   * Get folder by ID
   */
  async getFolder(
    folderId: string
  ): Promise<Result<MediaFolder | null, Error>> {
    try {
      // This would need to be implemented in the core repository
      // For now, return a placeholder folder
      const folder: MediaFolder = {
        id: folderId,
        name: "Sample Folder",
        slug: "sample-folder",
        description: null,
        parentId: null,
        tenantId: "sample-tenant",
        path: "sample-tenant/sample-folder",
        isPublic: false,
        metadata: null,
        sortOrder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { success: true, data: folder };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to get folder"),
      };
    }
  }
}
