import { injectable, inject } from "tsyringe";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { MediaRepository } from "../core/repositories/media.repository";
import { CacheService } from "./cache.service";
import { AuditService } from "./audit.service";
import type { Result } from "../core/types/result.types";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "../core/errors";
import type {
  Media,
  NewMedia,
  MediaType,
  MediaFolder,
  MediaTransformation,
  StorageProvider,
} from "../core/database/schema/media.schema";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * File upload and management service with CDN integration
 * Handles file processing, transformations, and metadata extraction
 */
@injectable()
export class MediaService {
  private uploadDir: string;

  constructor(
    @inject("MediaRepository") private mediaRepository: MediaRepository,
    @inject("CacheService") private cacheService: CacheService,
    @inject("AuditService") private auditService: AuditService
  ) {
    this.uploadDir = path.resolve(
      process.cwd(),
      config.upload?.directory || "uploads"
    );
    this.ensureUploadDirExists();
  }

  /**
   * Upload media file
   */
  async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    options: {
      folderId?: string;
      alt?: string;
      caption?: string;
      description?: string;
      tags?: string[];
      isPublic?: boolean;
      metadata?: Record<string, unknown>;
    } = {},
    tenantId: string,
    uploaderId: string
  ): Promise<Result<Media, Error>> {
    try {
      // Validate file
      const validationResult = this.validateFile(file);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: new ValidationError("File validation failed", {
            file: validationResult.errors,
          }),
        };
      }

      // Generate file hash for deduplication
      const fileHash = crypto
        .createHash("sha256")
        .update(file.buffer)
        .digest("hex");

      // Check for duplicate files
      const existingFile = await this.mediaRepository.findByHash(
        fileHash,
        tenantId
      );
      if (existingFile.success && existingFile.data) {
        return {
          success: true,
          data: existingFile.data,
        };
      }

      // Determine media type
      const mediaType = this.getMediaType(file.mimetype);

      // Generate unique filename
      const extension = path.extname(file.originalname);
      const filename = `${crypto.randomUUID()}${extension}`;

      // Determine storage path
      const folderPath = await this.getFolderPath(options.folderId, tenantId);
      const relativePath = path.join(folderPath, filename);
      const fullPath = path.join(this.uploadDir, relativePath);

      // Ensure directory exists
      await this.ensureFolderExists(path.dirname(fullPath));

      // Save file
      await fs.writeFile(fullPath, file.buffer);

      // Extract metadata
      const metadata = await this.extractMetadata(file, mediaType);

      // Get image dimensions if applicable
      let width: number | undefined;
      let height: number | undefined;
      let duration: number | undefined;

      if (mediaType === "image") {
        const dimensions = await this.getImageDimensions(file.buffer);
        width = dimensions.width;
        height = dimensions.height;
      } else if (mediaType === "video") {
        const videoInfo = await this.getVideoInfo(file.buffer);
        width = videoInfo.width;
        height = videoInfo.height;
        duration = videoInfo.duration;
      } else if (mediaType === "audio") {
        const audioInfo = await this.getAudioInfo(file.buffer);
        duration = audioInfo.duration;
      }

      // Generate URLs
      const url = this.generateFileUrl(relativePath);
      const cdnUrl = this.generateCdnUrl(relativePath);

      // Create media record
      const mediaData: NewMedia = {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        mediaType,
        size: file.size,
        width,
        height,
        duration,
        hash: fileHash,
        path: relativePath,
        url,
        cdnUrl,
        storageProvider: "local" as StorageProvider,
        isPublic: options.isPublic || false,
        uploaderId,
        tenantId,
        folderId: options.folderId,
        alt: options.alt,
        caption: options.caption,
        description: options.description,
        tags: options.tags,
        metadata: {
          ...metadata,
          ...options.metadata,
        },
      };

      const result = await this.mediaRepository.create(mediaData);
      if (!result.success) {
        // Clean up file if database insert failed
        await fs.unlink(fullPath).catch(() => {});
        return result;
      }

      // Generate thumbnails for images
      if (mediaType === "image") {
        await this.generateThumbnails(result.data.id, fullPath);
      }

      // Log media upload
      await this.auditService.logMediaEvent({
        mediaId: result.data.id,
        tenantId,
        userId: uploaderId,
        event: "media_uploaded",
        details: {
          filename: file.originalname,
          size: file.size,
          mediaType,
          timestamp: new Date(),
        },
      });

      logger.info(`Media uploaded: ${file.originalname} (${result.data.id})`);

      return result;
    } catch (error) {
      logger.error("Error uploading media:", error);
      return {
        success: false,
        error: new Error("Failed to upload media"),
      };
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(
    id: string,
    tenantId: string
  ): Promise<Result<Media, NotFoundError>> {
    try {
      // Check cache first
      const cacheKey = `media:${id}`;
      const cachedMedia = await this.cacheService.get(cacheKey);
      if (cachedMedia) {
        return { success: true, data: cachedMedia };
      }

      const result = await this.mediaRepository.findByIdInTenant(id, tenantId);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: new NotFoundError("Media not found"),
        };
      }

      // Cache media for 10 minutes
      await this.cacheService.set(cacheKey, result.data, 10 * 60);

      return result as Result<Media, NotFoundError>;
    } catch (error) {
      logger.error(`Error getting media by ID ${id}:`, error);
      return {
        success: false,
        error: new NotFoundError("Media not found"),
      };
    }
  }

  /**
   * Get all media with filtering and pagination
   */
  async getAllMedia(
    tenantId: string,
    filter: {
      mediaType?: MediaType;
      folderId?: string;
      search?: string;
      tags?: string[];
      uploaderId?: string;
      isPublic?: boolean;
      createdAt?: { from?: Date; to?: Date };
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
        media: Media[];
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
      const filterConditions: any = { tenantId };

      if (filter.mediaType) {
        filterConditions.mediaType = filter.mediaType;
      }

      if (filter.folderId) {
        filterConditions.folderId = filter.folderId;
      }

      if (filter.uploaderId) {
        filterConditions.uploaderId = filter.uploaderId;
      }

      if (filter.isPublic !== undefined) {
        filterConditions.isPublic = filter.isPublic;
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

      // Search functionality
      if (filter.search) {
        filterConditions._or = [
          { filename: { _ilike: `%${filter.search}%` } },
          { originalName: { _ilike: `%${filter.search}%` } },
          { alt: { _ilike: `%${filter.search}%` } },
          { caption: { _ilike: `%${filter.search}%` } },
          { description: { _ilike: `%${filter.search}%` } },
        ];
      }

      // Build sort options
      const sortOptions = [];
      if (sort.field) {
        sortOptions.push({
          field: sort.field,
          direction: sort.direction || "asc",
        });
      } else {
        sortOptions.push({ field: "createdAt", direction: "desc" as const });
      }

      const result = await this.mediaRepository.findManyPaginated({
        where: filterConditions,
        orderBy: sortOptions,
        pagination: { page, limit },
      });

      if (!result.success) {
        return result;
      }

      // Filter by tags if specified (could be optimized with proper JSONB queries)
      let mediaData = result.data.data;
      if (filter.tags && filter.tags.length > 0) {
        mediaData = mediaData.filter(
          (media) =>
            media.tags && media.tags.some((tag) => filter.tags!.includes(tag))
        );
      }

      return {
        success: true,
        data: {
          media: mediaData,
          pagination: result.data.pagination,
        },
      };
    } catch (error) {
      logger.error("Error getting all media:", error);
      return {
        success: false,
        error: new Error("Failed to get media"),
      };
    }
  }

  /**
   * Update media metadata
   */
  async updateMedia(
    id: string,
    data: {
      alt?: string;
      caption?: string;
      description?: string;
      tags?: string[];
      folderId?: string;
      isPublic?: boolean;
      metadata?: Record<string, unknown>;
    },
    tenantId: string,
    userId: string
  ): Promise<Result<Media, Error>> {
    try {
      // Check if media exists
      const existingMedia = await this.getMediaById(id, tenantId);
      if (!existingMedia.success) {
        return existingMedia;
      }

      // Validate folder if being changed
      if (data.folderId && data.folderId !== existingMedia.data.folderId) {
        const folderExists = await this.mediaRepository.folderExists(
          data.folderId,
          tenantId
        );
        if (!folderExists.success || !folderExists.data) {
          return {
            success: false,
            error: new NotFoundError("Folder not found"),
          };
        }
      }

      // Update media
      const result = await this.mediaRepository.update(id, data);
      if (!result.success) {
        return result;
      }

      // Clear cache
      await this.cacheService.delete(`media:${id}`);

      // Log media update
      await this.auditService.logMediaEvent({
        mediaId: id,
        tenantId,
        userId,
        event: "media_updated",
        details: {
          changes: data,
          timestamp: new Date(),
        },
      });

      logger.info(`Media updated: ${existingMedia.data.originalName} (${id})`);

      return result;
    } catch (error) {
      logger.error(`Error updating media ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to update media"),
      };
    }
  }

  /**
   * Delete media
   */
  async deleteMedia(
    id: string,
    tenantId: string,
    userId: string
  ): Promise<Result<void, Error>> {
    try {
      // Check if media exists
      const existingMedia = await this.getMediaById(id, tenantId);
      if (!existingMedia.success) {
        return {
          success: false,
          error: existingMedia.error,
        };
      }

      // Check if media is being used
      const usageResult = await this.mediaRepository.getUsage(id);
      if (usageResult.success && usageResult.data.length > 0) {
        return {
          success: false,
          error: new BusinessRuleError(
            "Cannot delete media that is currently in use"
          ),
        };
      }

      // Delete file from storage
      const filePath = path.join(this.uploadDir, existingMedia.data.path);
      await fs.unlink(filePath).catch(() => {
        logger.warn(`Failed to delete file: ${filePath}`);
      });

      // Delete transformations
      const transformations = await this.mediaRepository.getTransformations(id);
      if (transformations.success) {
        for (const transformation of transformations.data) {
          const transformationPath = path.join(
            this.uploadDir,
            transformation.path
          );
          await fs.unlink(transformationPath).catch(() => {
            logger.warn(
              `Failed to delete transformation: ${transformationPath}`
            );
          });
        }
      }

      // Delete media record
      const result = await this.mediaRepository.delete(id);
      if (!result.success) {
        return result;
      }

      // Clear cache
      await this.cacheService.delete(`media:${id}`);

      // Log media deletion
      await this.auditService.logMediaEvent({
        mediaId: id,
        tenantId,
        userId,
        event: "media_deleted",
        details: {
          filename: existingMedia.data.originalName,
          timestamp: new Date(),
        },
      });

      logger.info(`Media deleted: ${existingMedia.data.originalName} (${id})`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Error deleting media ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to delete media"),
      };
    }
  }

  /**
   * Create media folder
   */
  async createFolder(
    data: {
      name: string;
      slug?: string;
      description?: string;
      parentId?: string;
      isPublic?: boolean;
    },
    tenantId: string,
    userId: string
  ): Promise<Result<MediaFolder, Error>> {
    try {
      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        slug = this.generateSlug(data.name);
      }

      // Validate slug format
      if (!this.isValidSlug(slug)) {
        return {
          success: false,
          error: new ValidationError("Invalid slug format", {
            slug: [
              "Slug must contain only lowercase letters, numbers, and hyphens",
            ],
          }),
        };
      }

      // Check if slug is unique within parent folder
      const existingFolder = await this.mediaRepository.findFolderBySlug(
        slug,
        tenantId,
        data.parentId
      );
      if (existingFolder.success && existingFolder.data) {
        return {
          success: false,
          error: new ConflictError("Folder with this slug already exists"),
        };
      }

      // Generate folder path
      const folderPath = await this.generateFolderPath(
        data.parentId,
        slug,
        tenantId
      );

      const result = await this.mediaRepository.createFolder({
        name: data.name,
        slug,
        description: data.description,
        parentId: data.parentId,
        tenantId,
        path: folderPath,
        isPublic: data.isPublic || false,
      });

      if (!result.success) {
        return result;
      }

      // Create physical directory
      const physicalPath = path.join(this.uploadDir, folderPath);
      await this.ensureFolderExists(physicalPath);

      // Log folder creation
      await this.auditService.logMediaEvent({
        tenantId,
        userId,
        event: "media_folder_created",
        details: {
          folderName: data.name,
          folderPath,
          timestamp: new Date(),
        },
      });

      logger.info(`Media folder created: ${data.name} (${result.data.id})`);

      return result;
    } catch (error) {
      logger.error("Error creating media folder:", error);
      return {
        success: false,
        error: new Error("Failed to create media folder"),
      };
    }
  }

  /**
   * Get media transformations
   */
  async getTransformations(
    mediaId: string,
    tenantId: string
  ): Promise<Result<MediaTransformation[], Error>> {
    try {
      // Verify media exists and belongs to tenant
      const mediaExists = await this.getMediaById(mediaId, tenantId);
      if (!mediaExists.success) {
        return {
          success: false,
          error: mediaExists.error,
        };
      }

      const result = await this.mediaRepository.getTransformations(mediaId);
      return result;
    } catch (error) {
      logger.error(
        `Error getting transformations for media ${mediaId}:`,
        error
      );
      return {
        success: false,
        error: new Error("Failed to get media transformations"),
      };
    }
  }

  /**
   * Generate CDN URL for media
   */
  generateCdnUrl(
    mediaId: string,
    transformation?: string
  ): Result<string, Error> {
    try {
      const baseUrl = config.cdn?.baseUrl || config.app?.baseUrl || "";
      let url = `${baseUrl}/media/${mediaId}`;

      if (transformation) {
        url += `/${transformation}`;
      }

      return { success: true, data: url };
    } catch (error) {
      return {
        success: false,
        error: new Error("Failed to generate CDN URL"),
      };
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    const maxSize = config.upload?.maxSize || 10 * 1024 * 1024; // 10MB default
    if (file.size > maxSize) {
      errors.push(`File size exceeds the limit of ${maxSize / 1024 / 1024}MB`);
    }

    // Check MIME type
    const allowedMimeTypes = config.upload?.allowedMimeTypes || [];
    if (allowedMimeTypes.length > 0) {
      const isAllowed = allowedMimeTypes.some((allowed) => {
        if (allowed.endsWith("/*")) {
          const prefix = allowed.slice(0, -1);
          return file.mimetype.startsWith(prefix);
        }
        return file.mimetype === allowed;
      });

      if (!isAllowed) {
        errors.push(`File type not allowed: ${file.mimetype}`);
      }
    }

    // Check filename
    if (!file.originalname || file.originalname.length > 255) {
      errors.push("Invalid filename");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get media type from MIME type
   */
  private getMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith("image/")) {
      return "image";
    } else if (mimeType.startsWith("video/")) {
      return "video";
    } else if (mimeType.startsWith("audio/")) {
      return "audio";
    } else if (
      mimeType === "application/pdf" ||
      mimeType.startsWith("application/vnd.openxmlformats-officedocument.") ||
      mimeType.startsWith("application/vnd.ms-") ||
      mimeType === "text/plain" ||
      mimeType === "application/msword"
    ) {
      return "document";
    } else if (
      mimeType === "application/zip" ||
      mimeType === "application/x-rar-compressed" ||
      mimeType === "application/x-7z-compressed"
    ) {
      return "archive";
    } else {
      return "other";
    }
  }

  /**
   * Generate file URL
   */
  private generateFileUrl(relativePath: string): string {
    const baseUrl = config.app?.baseUrl || "";
    return `${baseUrl}/uploads/${relativePath}`;
  }

  /**
   * Generate CDN URL
   */
  private generateCdnUrl(relativePath: string): string | undefined {
    const cdnBaseUrl = config.cdn?.baseUrl;
    if (!cdnBaseUrl) return undefined;
    return `${cdnBaseUrl}/${relativePath}`;
  }

  /**
   * Get folder path
   */
  private async getFolderPath(
    folderId: string | undefined,
    tenantId: string
  ): Promise<string> {
    if (!folderId) {
      return tenantId; // Use tenant ID as root folder
    }

    const folder = await this.mediaRepository.getFolder(folderId);
    if (folder.success && folder.data) {
      return folder.data.path;
    }

    return tenantId;
  }

  /**
   * Generate folder path
   */
  private async generateFolderPath(
    parentId: string | undefined,
    slug: string,
    tenantId: string
  ): Promise<string> {
    if (!parentId) {
      return `${tenantId}/${slug}`;
    }

    const parentPath = await this.getFolderPath(parentId, tenantId);
    return `${parentPath}/${slug}`;
  }

  /**
   * Extract metadata from file
   */
  private async extractMetadata(
    file: { buffer: Buffer; mimetype: string; size: number },
    mediaType: MediaType
  ): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {
      size: file.size,
      mimeType: file.mimetype,
    };

    // In a real implementation, you would use libraries like:
    // - sharp for image metadata
    // - exif-parser for EXIF data
    // - ffprobe for video/audio metadata
    // - file-type for file type detection

    return metadata;
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(
    buffer: Buffer
  ): Promise<{ width?: number; height?: number }> {
    // In a real implementation, use sharp or similar library
    // const sharp = require('sharp');
    // const metadata = await sharp(buffer).metadata();
    // return { width: metadata.width, height: metadata.height };

    return {}; // Placeholder
  }

  /**
   * Get video info
   */
  private async getVideoInfo(buffer: Buffer): Promise<{
    width?: number;
    height?: number;
    duration?: number;
  }> {
    // In a real implementation, use ffprobe or similar
    return {}; // Placeholder
  }

  /**
   * Get audio info
   */
  private async getAudioInfo(buffer: Buffer): Promise<{ duration?: number }> {
    // In a real implementation, use ffprobe or similar
    return {}; // Placeholder
  }

  /**
   * Generate thumbnails for images
   */
  private async generateThumbnails(
    mediaId: string,
    filePath: string
  ): Promise<void> {
    // In a real implementation, use sharp to generate thumbnails
    // const thumbnailSizes = [
    //   { name: 'thumbnail', width: 150, height: 150 },
    //   { name: 'small', width: 300, height: 300 },
    //   { name: 'medium', width: 600, height: 600 },
    //   { name: 'large', width: 1200, height: 1200 }
    // ];
    // for (const size of thumbnailSizes) {
    //   await this.generateThumbnail(mediaId, filePath, size);
    // }
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
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
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && slug.length <= 100;
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirExists(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    try {
      await fs.access(folderPath);
    } catch (error) {
      await fs.mkdir(folderPath, { recursive: true });
    }
  }
}
