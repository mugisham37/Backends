import type { FastifyReply, FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { Auth } from "../../core/decorators/auth.decorator";
import {
  parsePaginationParams,
  parseSortParams,
} from "../../shared/utils/helpers";
import { ContentService } from "./content.service";

// Type definitions for Fastify requests
interface ContentQueryParams extends Record<string, unknown> {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  contentTypeId?: string;
  status?: string;
  locale?: string;
  search?: string;
  createdBy?: string;
  updatedBy?: string;
  publishedBy?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  publishedFrom?: string;
  publishedTo?: string;
}

interface ContentParams {
  id?: string;
  slug?: string;
  contentId?: string;
  versionId?: string;
}

interface CreateContentBody {
  title: string;
  content: string;
  contentType:
    | "page"
    | "custom"
    | "article"
    | "blog_post"
    | "news"
    | "documentation";
  status?: "draft" | "published" | "archived" | "scheduled";
  locale?: string;
  slug?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface UpdateContentBody {
  title?: string;
  content?: string;
  contentType?:
    | "page"
    | "custom"
    | "article"
    | "blog_post"
    | "news"
    | "documentation";
  status?: "draft" | "published" | "archived" | "scheduled";
  locale?: string;
  slug?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface PublishContentBody {
  scheduledAt?: string;
}

@injectable()
@Auth()
export class ContentController {
  constructor(
    @inject("ContentService") private _contentService: ContentService
  ) {}

  /**
   * Get all content
   */
  public getAllContent = async (
    request: FastifyRequest<{
      Querystring: ContentQueryParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // Get tenantId from request (typically set by middleware)
      const tenantId = (request as any).tenantId || "default";

      // Parse query parameters
      const { page, limit } = parsePaginationParams(request.query);
      const { field, direction } = parseSortParams(
        request.query,
        "updatedAt",
        "desc"
      );

      // Build filter
      const filter: any = {};
      if (request.query.contentTypeId)
        filter.contentType = request.query.contentTypeId;
      if (request.query.status) filter.status = request.query.status;
      if (request.query.locale) filter.locale = request.query.locale;
      if (request.query.search) filter.search = request.query.search;
      if (request.query.createdBy) filter.authorId = request.query.createdBy;
      if (request.query.updatedBy) filter.updatedBy = request.query.updatedBy;
      if (request.query.publishedBy)
        filter.publishedBy = request.query.publishedBy;

      // Handle date ranges
      if (request.query.createdFrom || request.query.createdTo) {
        filter.createdAt = {};
        if (request.query.createdFrom)
          filter.createdAt.from = new Date(request.query.createdFrom);
        if (request.query.createdTo)
          filter.createdAt.to = new Date(request.query.createdTo);
      }

      if (request.query.updatedFrom || request.query.updatedTo) {
        filter.updatedAt = {};
        if (request.query.updatedFrom)
          filter.updatedAt.from = new Date(request.query.updatedFrom);
        if (request.query.updatedTo)
          filter.updatedAt.to = new Date(request.query.updatedTo);
      }

      if (request.query.publishedFrom || request.query.publishedTo) {
        filter.publishedAt = {};
        if (request.query.publishedFrom)
          filter.publishedAt.from = new Date(request.query.publishedFrom);
        if (request.query.publishedTo)
          filter.publishedAt.to = new Date(request.query.publishedTo);
      }

      // Get content
      const result = await this._contentService.getAllContent(
        tenantId,
        filter,
        { field, direction },
        { page, limit }
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to get content",
          code: "GET_CONTENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data.content,
          pagination: {
            page: result.data.pagination.page,
            limit,
            totalPages: result.data.pagination.totalPages,
            totalCount: result.data.pagination.total,
          },
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get content by ID
   */
  public getContentById = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const result = await this._contentService.getContentById(id, tenantId);

      if (!result.success) {
        return reply.status(404).send({
          status: "error",
          message: result.error?.message || "Content not found",
          code: "CONTENT_NOT_FOUND",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get content by slug
   */
  public getContentBySlug = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { slug } = request.params;

      if (!slug) {
        return reply.status(400).send({
          status: "error",
          message: "Content slug is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const result = await this._contentService.getContentBySlug(slug, tenantId);

      if (!result.success) {
        return reply.status(404).send({
          status: "error",
          message: result.error?.message || "Content not found",
          code: "CONTENT_NOT_FOUND",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Create content
   */
  public createContent = async (
    request: FastifyRequest<{
      Body: CreateContentBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this._contentService.createContent(
        request.body,
        tenantId,
        userId
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to create content",
          code: "CREATE_CONTENT_FAILED",
        });
      }

      return reply.status(201).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Update content
   */
  public updateContent = async (
    request: FastifyRequest<{
      Params: ContentParams;
      Body: UpdateContentBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this._contentService.updateContent(
        id,
        request.body,
        tenantId,
        userId
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to update content",
          code: "UPDATE_CONTENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Delete content
   */
  public deleteContent = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this._contentService.deleteContent(
        id,
        tenantId,
        userId
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to delete content",
          code: "DELETE_CONTENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: null,
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Publish content
   */
  public publishContent = async (
    request: FastifyRequest<{
      Params: ContentParams;
      Body: PublishContentBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      const scheduledAt = request.body.scheduledAt
        ? new Date(request.body.scheduledAt)
        : undefined;

      const result = await this._contentService.publishContent(
        id,
        tenantId,
        userId,
        scheduledAt
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to publish content",
          code: "PUBLISH_CONTENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Unpublish content
   */
  public unpublishContent = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this._contentService.unpublishContent(
        id,
        tenantId,
        userId
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to unpublish content",
          code: "UNPUBLISH_CONTENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Archive content (soft delete)
   */
  public archiveContent = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      // Archive is implemented as updating status to 'archived'
      const result = await this._contentService.updateContent(
        id,
        { status: "archived" as any },
        tenantId,
        userId
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to archive content",
          code: "ARCHIVE_CONTENT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get content versions
   */
  public getContentVersions = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { contentId } = request.params;

      if (!contentId) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const result = await this._contentService.getContentVersions(
        contentId,
        tenantId
      );

      if (!result.success) {
        return reply.status(404).send({
          status: "error",
          message: result.error?.message || "Content versions not found",
          code: "CONTENT_VERSIONS_NOT_FOUND",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          versions: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Restore content version
   */
  public restoreVersion = async (
    request: FastifyRequest<{
      Params: ContentParams;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { contentId, versionId } = request.params;

      if (!contentId || !versionId) {
        return reply.status(400).send({
          status: "error",
          message: "Content ID and version ID are required",
        });
      }

      const tenantId = (request as any).tenantId || "default";
      const userId = (request as any).user?._id;

      if (!userId) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
        });
      }

      const versionNumber = parseInt(versionId, 10);
      if (Number.isNaN(versionNumber)) {
        return reply.status(400).send({
          status: "error",
          message: "Invalid version ID",
        });
      }

      const result = await this._contentService.restoreVersion(
        contentId,
        versionNumber,
        tenantId,
        userId
      );

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Failed to restore content version",
          code: "RESTORE_VERSION_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (_error) {
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };
}
