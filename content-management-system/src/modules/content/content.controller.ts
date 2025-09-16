import type { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { ContentService } from "./content.service";
import { parsePaginationParams, parseSortParams } from "../utils/helpers";

@injectable()
export class ContentController {
  constructor(
    @inject("ContentService") private contentService: ContentService
  ) {}

  /**
   * Get all content
   */
  public getAllContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Get tenantId from request (typically set by middleware)
      const tenantId = (req as any).tenantId || "default";

      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query);
      const { field, direction } = parseSortParams(
        req.query,
        "updatedAt",
        "desc"
      );

      // Build filter
      const filter: any = {};
      if (req.query["contentTypeId"])
        filter.contentType = req.query["contentTypeId"] as string;
      if (req.query["status"]) filter.status = req.query["status"] as string;
      if (req.query["locale"]) filter.locale = req.query["locale"] as string;
      if (req.query["search"]) filter.search = req.query["search"] as string;
      if (req.query["createdBy"])
        filter.authorId = req.query["createdBy"] as string;
      if (req.query["updatedBy"])
        filter.updatedBy = req.query["updatedBy"] as string;
      if (req.query["publishedBy"])
        filter.publishedBy = req.query["publishedBy"] as string;

      // Handle date ranges
      if (req.query["createdFrom"] || req.query["createdTo"]) {
        filter.createdAt = {};
        if (req.query["createdFrom"])
          filter.createdAt.from = new Date(req.query["createdFrom"] as string);
        if (req.query["createdTo"])
          filter.createdAt.to = new Date(req.query["createdTo"] as string);
      }

      if (req.query["updatedFrom"] || req.query["updatedTo"]) {
        filter.updatedAt = {};
        if (req.query["updatedFrom"])
          filter.updatedAt.from = new Date(req.query["updatedFrom"] as string);
        if (req.query["updatedTo"])
          filter.updatedAt.to = new Date(req.query["updatedTo"] as string);
      }

      if (req.query["publishedFrom"] || req.query["publishedTo"]) {
        filter.publishedAt = {};
        if (req.query["publishedFrom"])
          filter.publishedAt.from = new Date(
            req.query["publishedFrom"] as string
          );
        if (req.query["publishedTo"])
          filter.publishedAt.to = new Date(req.query["publishedTo"] as string);
      }

      // Get content
      const result = await this.contentService.getAllContent(
        tenantId,
        filter,
        { field, direction },
        { page, limit }
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
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
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get content by ID
   */
  public getContentById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const result = await this.contentService.getContentById(id, tenantId);

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get content by slug
   */
  public getContentBySlug = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({
          status: "error",
          message: "Content slug is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const result = await this.contentService.getContentBySlug(slug, tenantId);

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create content
   */
  public createContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this.contentService.createContent(
        req.body,
        tenantId,
        userId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(201).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update content
   */
  public updateContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this.contentService.updateContent(
        id,
        req.body,
        tenantId,
        userId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete content
   */
  public deleteContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this.contentService.deleteContent(
        id,
        tenantId,
        userId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Publish content
   */
  public publishContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      const scheduledAt = req.body.scheduledAt
        ? new Date(req.body.scheduledAt)
        : undefined;

      const result = await this.contentService.publishContent(
        id,
        tenantId,
        userId,
        scheduledAt
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Unpublish content
   */
  public unpublishContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      const result = await this.contentService.unpublishContent(
        id,
        tenantId,
        userId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Archive content (soft delete)
   */
  public archiveContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      // Archive is implemented as updating status to 'archived'
      const result = await this.contentService.updateContent(
        id,
        { status: "archived" as any },
        tenantId,
        userId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get content versions
   */
  public getContentVersions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { contentId } = req.params;

      if (!contentId) {
        return res.status(400).json({
          status: "error",
          message: "Content ID is required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const result = await this.contentService.getContentVersions(
        contentId,
        tenantId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          versions: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Restore content version
   */
  public restoreVersion = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { contentId, versionId } = req.params;

      if (!contentId || !versionId) {
        return res.status(400).json({
          status: "error",
          message: "Content ID and version ID are required",
        });
      }

      const tenantId = (req as any).tenantId || "default";
      const userId = (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      const versionNumber = parseInt(versionId, 10);
      if (isNaN(versionNumber)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid version ID",
        });
      }

      const result = await this.contentService.restoreVersion(
        contentId,
        versionNumber,
        tenantId,
        userId
      );

      if (!result.success) {
        return next(result.error);
      }

      res.status(200).json({
        status: "success",
        data: {
          content: result.data,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
