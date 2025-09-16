import type { NextFunction, Request, Response } from "express";
import { ContentService } from "./content.service";
import { parsePaginationParams, parseSortParams } from "../utils/helpers";

export class ContentController {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  /**
   * Get all content
   */
  public getAllContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query);
      const { field, direction } = parseSortParams(
        req.query,
        "updatedAt",
        "desc"
      );

      // Build filter
      const filter: any = {};
      if (req.query.contentTypeId)
        filter.contentTypeId = req.query.contentTypeId as string;
      if (req.query.status) filter.status = req.query.status as string;
      if (req.query.locale) filter.locale = req.query.locale as string;
      if (req.query.search) filter.search = req.query.search as string;
      if (req.query.createdBy) filter.createdBy = req.query.createdBy as string;
      if (req.query.updatedBy) filter.updatedBy = req.query.updatedBy as string;
      if (req.query.publishedBy)
        filter.publishedBy = req.query.publishedBy as string;

      // Handle date ranges
      if (req.query.createdFrom || req.query.createdTo) {
        filter.createdAt = {};
        if (req.query.createdFrom)
          filter.createdAt.from = new Date(req.query.createdFrom as string);
        if (req.query.createdTo)
          filter.createdAt.to = new Date(req.query.createdTo as string);
      }

      if (req.query.updatedFrom || req.query.updatedTo) {
        filter.updatedAt = {};
        if (req.query.updatedFrom)
          filter.updatedAt.from = new Date(req.query.updatedFrom as string);
        if (req.query.updatedTo)
          filter.updatedAt.to = new Date(req.query.updatedTo as string);
      }

      if (req.query.publishedFrom || req.query.publishedTo) {
        filter.publishedAt = {};
        if (req.query.publishedFrom)
          filter.publishedAt.from = new Date(req.query.publishedFrom as string);
        if (req.query.publishedTo)
          filter.publishedAt.to = new Date(req.query.publishedTo as string);
      }

      // Get content
      const result = await this.contentService.getAllContent(
        filter,
        { field, direction },
        { page, limit }
      );

      res.status(200).json({
        status: "success",
        data: {
          content: result.content,
          pagination: {
            page: result.page,
            limit,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
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
      const content = await this.contentService.getContentById(id);

      res.status(200).json({
        status: "success",
        data: {
          content,
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
      const { contentTypeId, slug } = req.params;
      const locale = (req.query.locale as string) || "en";
      const content = await this.contentService.getContentBySlug(
        contentTypeId,
        slug,
        locale
      );

      res.status(200).json({
        status: "success",
        data: {
          content,
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
      const userId = (req as any).user?._id;
      const content = await this.contentService.createContent(req.body, userId);

      res.status(201).json({
        status: "success",
        data: {
          content,
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
      const userId = (req as any).user?._id;
      const content = await this.contentService.updateContent(
        id,
        req.body,
        userId
      );

      res.status(200).json({
        status: "success",
        data: {
          content,
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
      await this.contentService.deleteContent(id);

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
      const userId = (req as any).user?._id;
      const scheduledAt = req.body.scheduledAt
        ? new Date(req.body.scheduledAt)
        : undefined;
      const content = await this.contentService.publishContent(
        id,
        userId,
        scheduledAt
      );

      res.status(200).json({
        status: "success",
        data: {
          content,
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
      const content = await this.contentService.unpublishContent(id);

      res.status(200).json({
        status: "success",
        data: {
          content,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Archive content
   */
  public archiveContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const content = await this.contentService.archiveContent(id);

      res.status(200).json({
        status: "success",
        data: {
          content,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get content version
   */
  public getContentVersion = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { contentId, versionId } = req.params;
      const version = await this.contentService.getContentVersion(
        contentId,
        versionId
      );

      res.status(200).json({
        status: "success",
        data: {
          version,
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
      const userId = (req as any).user?._id;
      const content = await this.contentService.restoreVersion(
        contentId,
        versionId,
        userId
      );

      res.status(200).json({
        status: "success",
        data: {
          content,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
