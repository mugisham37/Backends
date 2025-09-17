import type { FastifyRequest, FastifyReply } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { inject, injectable } from "tsyringe";
import { MediaService } from "./media.service";
import {
  parsePaginationParams,
  parseSortParams,
} from "../../shared/utils/helpers";
import { logger } from "../../shared/utils/logger";
import { Auth } from "../../core/decorators/auth.decorator";

// Type definitions for Fastify requests
interface MediaQueryParams extends Record<string, unknown> {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  type?: "image" | "video" | "audio" | "document" | "other";
  search?: string;
  mimeType?: string;
  folderId?: string;
  isPublic?: string;
  tags?: string;
  minSize?: string;
  maxSize?: string;
  createdFrom?: string;
  createdTo?: string;
}

interface MediaParams {
  id: string;
}

interface FolderParams {
  path: string;
}

interface CreateFolderBody {
  name: string;
  parentId?: string;
  description?: string;
}

interface UpdateMediaBody {
  filename?: string;
  alt?: string;
  caption?: string;
  description?: string;
  tags?: string[];
  folderId?: string;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

interface UploadMediaFields {
  alt?: string;
  caption?: string;
  description?: string;
  tags?: string;
  folderId?: string;
  isPublic?: string;
  metadata?: string;
}

interface FolderQueryParams {
  parent?: string;
}

/**
 * Media controller for Fastify
 * Handles file uploads, media management, and folder operations
 */
@injectable()
@Auth()
export class MediaController {
  constructor(@inject("MediaService") private mediaService: MediaService) {}

  /**
   * Get all media with pagination and filtering
   */
  public getAllMedia = async (
    request: FastifyRequest<{
      Querystring: MediaQueryParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // Get tenant and user context
      const tenantId = (request as any).tenantId || "default";

      // Parse query parameters
      const { page, limit } = parsePaginationParams(request.query);
      const { field, direction } = parseSortParams(
        request.query,
        "createdAt",
        "desc"
      );

      // Build filter
      const filter: any = {};
      const query = request.query;

      if (query.type) filter.type = query.type;
      if (query.search) filter.search = query.search;
      if (query.mimeType) filter.mimeType = query.mimeType;
      if (query.folderId) filter.folderId = query.folderId;
      if (query.isPublic !== undefined)
        filter.isPublic = query.isPublic === "true";

      // Handle tags
      if (query.tags) {
        filter.tags =
          typeof query.tags === "string" ? query.tags.split(",") : query.tags;
      }

      // Handle size range
      if (query.minSize) filter.minSize = parseInt(query.minSize, 10);
      if (query.maxSize) filter.maxSize = parseInt(query.maxSize, 10);

      // Handle date range
      if (query.createdFrom || query.createdTo) {
        filter.createdAt = {};
        if (query.createdFrom)
          filter.createdAt.from = new Date(query.createdFrom);
        if (query.createdTo) filter.createdAt.to = new Date(query.createdTo);
      }

      // Get media with pagination
      const result = await this.mediaService.getAllMedia(
        tenantId,
        filter,
        { field, direction },
        { page, limit }
      );

      if (!result.success) {
        logger.error("Failed to get media:", result.error);
        return reply.status(500).send({
          status: "error",
          message: result.error?.message || "Failed to retrieve media",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          media: result.data.media,
          pagination: result.data.pagination,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting media:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get media by ID
   */
  public getMediaById = async (
    request: FastifyRequest<{
      Params: MediaParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const tenantId = (request as any).tenantId || "default";

      const result = await this.mediaService.getMediaById(id, tenantId);

      if (!result.success) {
        if (result.error?.message.includes("not found")) {
          return reply.status(404).send({
            status: "error",
            message: "Media not found",
            timestamp: new Date().toISOString(),
          });
        }

        logger.error("Failed to get media:", result.error);
        return reply.status(500).send({
          status: "error",
          message: result.error?.message || "Failed to retrieve media",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          media: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting media by ID:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Upload media file using Fastify multipart
   */
  public uploadMedia = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if the request is multipart
      if (!request.isMultipart()) {
        return reply.status(400).send({
          status: "error",
          message: "Request must be multipart/form-data",
          timestamp: new Date().toISOString(),
        });
      }

      let file: MultipartFile | undefined;
      const fields: UploadMediaFields = {};

      // Process multipart data
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname === "file") {
            file = part;
          }
        } else {
          // Handle form fields
          const fieldName = part.fieldname as keyof UploadMediaFields;
          fields[fieldName] = part.value as any;
        }
      }

      if (!file) {
        return reply.status(400).send({
          status: "error",
          message: "No file uploaded",
          timestamp: new Date().toISOString(),
        });
      }

      // Convert file to buffer
      const buffer = await file.toBuffer();

      // Parse options from form fields
      const options: any = {};
      if (fields.alt) options.alt = fields.alt;
      if (fields.caption) options.caption = fields.caption;
      if (fields.description) options.description = fields.description;
      if (fields.folderId) options.folderId = fields.folderId;
      if (fields.isPublic) options.isPublic = fields.isPublic === "true";

      // Parse tags
      if (fields.tags) {
        try {
          options.tags = JSON.parse(fields.tags);
        } catch {
          // If not valid JSON, treat as comma-separated string
          options.tags = fields.tags
            .split(",")
            .map((tag: string) => tag.trim());
        }
      }

      // Parse metadata
      if (fields.metadata) {
        try {
          options.metadata = JSON.parse(fields.metadata);
        } catch (error) {
          logger.warn("Invalid metadata JSON:", error);
        }
      }

      // Upload file using the service
      const result = await this.mediaService.uploadFile(
        {
          buffer,
          originalname: file.filename,
          mimetype: file.mimetype,
          size: buffer.length,
        },
        options,
        tenantId,
        userId
      );

      if (!result.success) {
        logger.error("Failed to upload media:", result.error);
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to upload media",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          media: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error uploading media:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Update media metadata
   */
  public updateMedia = async (
    request: FastifyRequest<{
      Params: MediaParams;
      Body: UpdateMediaBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?.id;
      const updateData = request.body;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.mediaService.updateMedia(
        id,
        updateData,
        tenantId,
        userId
      );

      if (!result.success) {
        if (result.error?.message.includes("not found")) {
          return reply.status(404).send({
            status: "error",
            message: "Media not found",
            timestamp: new Date().toISOString(),
          });
        }

        logger.error("Failed to update media:", result.error);
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to update media",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          media: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error updating media:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Delete media
   */
  public deleteMedia = async (
    request: FastifyRequest<{
      Params: MediaParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;
      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.mediaService.deleteMedia(id, tenantId, userId);

      if (!result.success) {
        if (result.error?.message.includes("not found")) {
          return reply.status(404).send({
            status: "error",
            message: "Media not found",
            timestamp: new Date().toISOString(),
          });
        }

        logger.error("Failed to delete media:", result.error);
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to delete media",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "success",
        data: null,
        message: "Media deleted successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error deleting media:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Create folder
   */
  public createFolder = async (
    request: FastifyRequest<{
      Body: CreateFolderBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { name, parentId, description } = request.body;
      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        });
      }

      const folderData: {
        name: string;
        slug?: string;
        description?: string;
        parentId?: string;
        isPublic?: boolean;
      } = { name };

      if (parentId) folderData.parentId = parentId;
      if (description) folderData.description = description;

      const result = await this.mediaService.createFolder(
        folderData,
        tenantId,
        userId
      );

      if (!result.success) {
        logger.error("Failed to create folder:", result.error);
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to create folder",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          folder: result.data,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error creating folder:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Delete folder (simplified implementation - needs service method)
   */
  public deleteFolder = async (
    _request: FastifyRequest<{
      Params: FolderParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // This is a placeholder implementation
      // The MediaService needs to implement deleteFolderByPath method
      return reply.status(501).send({
        status: "error",
        message:
          "Delete folder functionality not yet implemented in MediaService",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error deleting folder:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * List folders (simplified implementation - needs service method)
   */
  public listFolders = async (
    _request: FastifyRequest<{
      Querystring: FolderQueryParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // This is a placeholder implementation
      // The MediaService needs to implement getFoldersByParent method
      return reply.status(501).send({
        status: "error",
        message:
          "List folders functionality not yet implemented in MediaService",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error listing folders:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  };
}
