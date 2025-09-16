import { injectable, inject } from "tsyringe";
import type {
  IMediaService,
  FileUpload,
  MediaMetadata,
  ImageTransformation,
  CdnOptions,
} from "../core/types/service.types";
import type { Result } from "../core/types/result.types";
import type {
  Media,
  PaginatedResult,
  FilterOptions,
} from "../core/types/database.types";
import { MediaService } from "./media.service";
import { NotFoundError, ValidationError } from "../core/errors";

/**
 * Media Service Adapter
 *
 * Adapts the existing MediaService to match the IMediaService interface
 * required by the REST endpoints.
 */
@injectable()
@injectable()
export class MediaServiceAdapter implements IMediaService {
  readonly name = "MediaServiceAdapter";

  constructor(
    @inject("OriginalMediaService") private mediaService: MediaService
  ) {}

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async destroy(): Promise<void> {
    // No cleanup needed
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    return { healthy: true };
  }

  async uploadFile(
    file: FileUpload,
    metadata: MediaMetadata & { tenantId: string; uploadedBy: string }
  ): Promise<Result<Media, Error>> {
    try {
      const fileData = {
        buffer: file.buffer,
        originalname: file.filename,
        mimetype: file.mimeType,
        size: file.size,
      };

      const options = {
        alt: metadata.alt,
        caption: metadata.caption,
        tags: metadata.tags,
        metadata: metadata.metadata,
      };

      return await this.mediaService.uploadFile(
        fileData,
        options,
        metadata.tenantId,
        metadata.uploadedBy
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Upload failed"),
      };
    }
  }

  async getFile(id: string): Promise<Result<Media | null, Error>> {
    try {
      // We need to get tenantId from context, but for now we'll try to get it from the media record
      // In a real implementation, this should be passed from the request context
      const result = await this.mediaService.getMediaById(id, ""); // This will need tenant context

      if (!result.success) {
        return {
          success: false,
          error: new NotFoundError("Media not found"),
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Failed to get file"),
      };
    }
  }

  async updateFile(
    id: string,
    data: {
      alt?: string;
      caption?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<Result<Media, Error>> {
    try {
      // This would need tenant and user context in a real implementation
      return await this.mediaService.updateMedia(id, data, "", "");
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to update file"),
      };
    }
  }

  async deleteFile(id: string): Promise<Result<void, Error>> {
    try {
      // This would need tenant and user context in a real implementation
      return await this.mediaService.deleteMedia(id, "", "");
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to delete file"),
      };
    }
  }

  async listFiles(
    options?: FilterOptions<Media>
  ): Promise<Result<PaginatedResult<Media>, Error>> {
    try {
      // Convert FilterOptions to the format expected by MediaService
      const filter = {
        mediaType: options?.filters?.mediaType as any,
        search: options?.search,
        tags: options?.filters?.tags as string[],
      };

      const sort = {
        field: options?.sortBy,
        direction: options?.sortOrder,
      };

      const pagination = {
        page: options?.page || 1,
        limit: options?.limit || 20,
      };

      // This would need tenant context in a real implementation
      const result = await this.mediaService.getAllMedia(
        "",
        filter,
        sort,
        pagination
      );

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          items: result.data.media,
          total: result.data.pagination.total,
          page: result.data.pagination.page,
          limit: result.data.pagination.limit,
          hasMore: result.data.pagination.hasNext,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to list files"),
      };
    }
  }

  async processImage(
    id: string,
    transformations: ImageTransformation[]
  ): Promise<Result<Media, Error>> {
    try {
      // This is a placeholder implementation
      // In a real implementation, you would:
      // 1. Get the original media file
      // 2. Apply transformations using a library like Sharp
      // 3. Save the transformed image
      // 4. Return the updated media record

      const media = await this.getFile(id);
      if (!media.success || !media.data) {
        return {
          success: false,
          error: new NotFoundError("Media not found"),
        };
      }

      // Check if it's an image
      if (!media.data.mimeType.startsWith("image/")) {
        return {
          success: false,
          error: new ValidationError("File is not an image"),
        };
      }

      // For now, just return the original media
      // In a real implementation, apply transformations here
      return {
        success: true,
        data: media.data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to process image"),
      };
    }
  }

  async generateCdnUrl(
    id: string,
    options?: CdnOptions
  ): Promise<Result<string, Error>> {
    try {
      const media = await this.getFile(id);
      if (!media.success || !media.data) {
        return {
          success: false,
          error: new NotFoundError("Media not found"),
        };
      }

      // Use the existing CDN URL generation
      const result = this.mediaService.generateCdnUrl(id);

      if (!result.success) {
        return result;
      }

      let url = result.data;

      // Apply transformations to URL if specified
      if (options?.transformations && options.transformations.length > 0) {
        const transformParams = options.transformations
          .map((t) => `${t.type}=${JSON.stringify(t.params)}`)
          .join("&");
        url += `?${transformParams}`;
      }

      // Add expiration if specified
      if (options?.expires) {
        const separator = url.includes("?") ? "&" : "?";
        const expiresAt = new Date(Date.now() + options.expires * 1000);
        url += `${separator}expires=${expiresAt.toISOString()}`;
      }

      return {
        success: true,
        data: url,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to generate CDN URL"),
      };
    }
  }

  async generateThumbnail(
    id: string,
    size: { width: number; height: number; fit?: "cover" | "contain" | "fill" }
  ): Promise<Result<string, Error>> {
    try {
      // This would generate a thumbnail and return its URL
      // For now, just return the CDN URL with size parameters
      const cdnResult = await this.generateCdnUrl(id, {
        transformations: [
          {
            type: "resize",
            params: {
              width: size.width,
              height: size.height,
              fit: size.fit || "cover",
            },
          },
        ],
      });

      return cdnResult;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to generate thumbnail"),
      };
    }
  }

  async getFileStream(
    id: string
  ): Promise<Result<NodeJS.ReadableStream, Error>> {
    try {
      // This would return a readable stream of the file
      // For now, return an error as this is not implemented
      return {
        success: false,
        error: new Error("File streaming not implemented"),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to get file stream"),
      };
    }
  }

  async validateFile(file: FileUpload): Promise<Result<boolean, Error>> {
    try {
      // Use the existing validation logic
      const fileData = {
        buffer: file.buffer,
        originalname: file.filename,
        mimetype: file.mimeType,
        size: file.size,
      };

      // Access the private validation method through a workaround
      // In a real implementation, this validation logic should be public or extracted
      const validation = (this.mediaService as any).validateFile(fileData);

      if (!validation.isValid) {
        return {
          success: false,
          error: new ValidationError(
            "File validation failed",
            validation.errors
          ),
        };
      }

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error("Failed to validate file"),
      };
    }
  }

  // Helper method to get media by tenant (used by REST routes)
  async getMediaByTenant(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
      tags?: string[];
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<Result<PaginatedResult<Media>, Error>> {
    try {
      const filter = {
        mediaType: options.type as any,
        search: options.search,
        tags: options.tags,
      };

      const sort = {
        field: options.sortBy,
        direction: options.sortOrder,
      };

      const pagination = {
        page: options.page || 1,
        limit: options.limit || 20,
      };

      const result = await this.mediaService.getAllMedia(
        tenantId,
        filter,
        sort,
        pagination
      );

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          items: result.data.media,
          total: result.data.pagination.total,
          page: result.data.pagination.page,
          limit: result.data.pagination.limit,
          hasMore: result.data.pagination.hasNext,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to get media by tenant"),
      };
    }
  }
}
