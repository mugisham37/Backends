import type { Request, Response, NextFunction } from "express"
import { ContentTypeService } from "../services/content-type.service"
import { parsePaginationParams, parseSortParams } from "../utils/helpers"

export class ContentTypeController {
  private contentTypeService: ContentTypeService

  constructor() {
    this.contentTypeService = new ContentTypeService()
  }

  /**
   * Get all content types
   */
  public getAllContentTypes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query)
      const { field, direction } = parseSortParams(req.query, "createdAt", "desc")

      // Build filter
      const filter: any = {}
      if (req.query.search) filter.search = req.query.search as string
      if (req.query.isSystem !== undefined) filter.isSystem = req.query.isSystem === "true"

      // Get content types
      const result = await this.contentTypeService.getAllContentTypes(filter, { field, direction }, { page, limit })

      res.status(200).json({
        status: "success",
        data: {
          contentTypes: result.contentTypes,
          pagination: {
            page: result.page,
            limit,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get content type by ID
   */
  public getContentTypeById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const contentType = await this.contentTypeService.getContentTypeById(id)

      res.status(200).json({
        status: "success",
        data: {
          contentType,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create content type
   */
  public createContentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contentType = await this.contentTypeService.createContentType(req.body)

      res.status(201).json({
        status: "success",
        data: {
          contentType,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update content type
   */
  public updateContentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const contentType = await this.contentTypeService.updateContentType(id, req.body)

      res.status(200).json({
        status: "success",
        data: {
          contentType,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete content type
   */
  public deleteContentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      await this.contentTypeService.deleteContentType(id)

      res.status(200).json({
        status: "success",
        data: null,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Add field to content type
   */
  public addField = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const contentType = await this.contentTypeService.addField(id, req.body)

      res.status(200).json({
        status: "success",
        data: {
          contentType,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update field in content type
   */
  public updateField = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, fieldId } = req.params
      const contentType = await this.contentTypeService.updateField(id, fieldId, req.body)

      res.status(200).json({
        status: "success",
        data: {
          contentType,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Remove field from content type
   */
  public removeField = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, fieldId } = req.params
      const contentType = await this.contentTypeService.removeField(id, fieldId)

      res.status(200).json({
        status: "success",
        data: {
          contentType,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
