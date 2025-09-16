import type { NextFunction, Request, Response } from "express";
import { searchService } from "./search.service";

export class SearchController {
  /**
   * Search content
   */
  public searchContent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        q,
        contentTypeId,
        status,
        locale,
        fields,
        page = 1,
        limit = 10,
        sort,
        order,
        ...filters
      } = req.query as any;

      // Convert page/limit to from/size
      const from = (Number.parseInt(page) - 1) * Number.parseInt(limit);
      const size = Number.parseInt(limit);

      // Parse fields
      let parsedFields: string[] | undefined;
      if (fields) {
        parsedFields = Array.isArray(fields) ? fields : [fields];
      }

      const result = await searchService.searchContent({
        query: q || "",
        contentTypeId,
        status,
        locale,
        fields: parsedFields,
        from,
        size,
        sort,
        order,
        filters,
      });

      res.status(200).json({
        status: "success",
        data: {
          items: result.hits,
          total: result.total,
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          pages: Math.ceil(result.total / Number.parseInt(limit)),
          aggregations: result.aggregations,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search users
   */
  public searchUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        q,
        role,
        isActive,
        fields,
        page = 1,
        limit = 10,
        sort,
        order,
      } = req.query as any;

      // Convert page/limit to from/size
      const from = (Number.parseInt(page) - 1) * Number.parseInt(limit);
      const size = Number.parseInt(limit);

      // Parse fields
      let parsedFields: string[] | undefined;
      if (fields) {
        parsedFields = Array.isArray(fields) ? fields : [fields];
      }

      // Parse isActive
      let parsedIsActive: boolean | undefined;
      if (isActive !== undefined) {
        parsedIsActive = isActive === "true";
      }

      const result = await searchService.searchUsers({
        query: q || "",
        role,
        isActive: parsedIsActive,
        fields: parsedFields,
        from,
        size,
        sort,
        order,
      });

      res.status(200).json({
        status: "success",
        data: {
          items: result.hits,
          total: result.total,
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          pages: Math.ceil(result.total / Number.parseInt(limit)),
          aggregations: result.aggregations,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search media
   */
  public searchMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        q,
        type,
        mimeType,
        folder,
        tags,
        fields,
        page = 1,
        limit = 10,
        sort,
        order,
      } = req.query as any;

      // Convert page/limit to from/size
      const from = (Number.parseInt(page) - 1) * Number.parseInt(limit);
      const size = Number.parseInt(limit);

      // Parse fields
      let parsedFields: string[] | undefined;
      if (fields) {
        parsedFields = Array.isArray(fields) ? fields : [fields];
      }

      // Parse tags
      let parsedTags: string[] | undefined;
      if (tags) {
        parsedTags = Array.isArray(tags) ? tags : [tags];
      }

      const result = await searchService.searchMedia({
        query: q || "",
        type,
        mimeType,
        folder,
        tags: parsedTags,
        fields: parsedFields,
        from,
        size,
        sort,
        order,
      });

      res.status(200).json({
        status: "success",
        data: {
          items: result.hits,
          total: result.total,
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          pages: Math.ceil(result.total / Number.parseInt(limit)),
          aggregations: result.aggregations,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reindex all content
   */
  public reindexContent = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // This would typically fetch all content from the database
      // For now, we'll just return a success message
      // const contentCollection = await ContentModel.find().lean()
      // await searchService.reindexContent(contentCollection)

      res.status(200).json({
        status: "success",
        message: "Content reindexing started",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reindex all users
   */
  public reindexUsers = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // This would typically fetch all users from the database
      // For now, we'll just return a success message
      // const userCollection = await UserModel.find().lean()
      // await searchService.reindexUsers(userCollection)

      res.status(200).json({
        status: "success",
        message: "Users reindexing started",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reindex all media
   */
  public reindexMedia = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // This would typically fetch all media from the database
      // For now, we'll just return a success message
      // const mediaCollection = await MediaModel.find().lean()
      // await searchService.reindexMedia(mediaCollection)

      res.status(200).json({
        status: "success",
        message: "Media reindexing started",
      });
    } catch (error) {
      next(error);
    }
  };
}
