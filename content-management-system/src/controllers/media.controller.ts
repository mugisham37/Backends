import type { Request, Response, NextFunction } from "express"
import { MediaService } from "../services/media.service"
import { parsePaginationParams, parseSortParams } from "../utils/helpers"
import multer from "multer"
import { config } from "../config"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSize,
  },
  fileFilter: (req, file, cb) => {
    // Check if MIME type is allowed
    const allowedMimeTypes = config.upload.allowedMimeTypes
    if (allowedMimeTypes.length > 0) {
      const isAllowed = allowedMimeTypes.some((allowed) => {
        if (allowed.endsWith("/*")) {
          const prefix = allowed.slice(0, -1)
          return file.mimetype.startsWith(prefix)
        }
        return file.mimetype === allowed
      })

      if (!isAllowed) {
        return cb(new Error(`File type not allowed: ${file.mimetype}`))
      }
    }
    cb(null, true)
  },
})

export class MediaController {
  private mediaService: MediaService

  constructor() {
    this.mediaService = new MediaService()
  }

  /**
   * Get all media
   */
  public getAllMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query)
      const { field, direction } = parseSortParams(req.query, "createdAt", "desc")

      // Build filter
      const filter: any = {}
      if (req.query.type) filter.type = req.query.type as string
      if (req.query.search) filter.search = req.query.search as string
      if (req.query.mimeType) filter.mimeType = req.query.mimeType as string
      if (req.query.folder) filter.folder = req.query.folder as string
      if (req.query.createdBy) filter.createdBy = req.query.createdBy as string

      // Handle tags
      if (req.query.tags) {
        if (Array.isArray(req.query.tags)) {
          filter.tags = req.query.tags as string[]
        } else {
          filter.tags = [req.query.tags as string]
        }
      }

      // Handle date range
      if (req.query.createdFrom || req.query.createdTo) {
        filter.createdAt = {}
        if (req.query.createdFrom) filter.createdAt.from = new Date(req.query.createdFrom as string)
        if (req.query.createdTo) filter.createdAt.to = new Date(req.query.createdTo as string)
      }

      // Get media
      const result = await this.mediaService.getAllMedia(filter, { field, direction }, { page, limit })

      res.status(200).json({
        status: "success",
        data: {
          media: result.media,
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
   * Get media by ID
   */
  public getMediaById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const media = await this.mediaService.getMediaById(id)

      res.status(200).json({
        status: "success",
        data: {
          media,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Upload media
   */
  public uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
    // Use multer middleware for file upload
    const uploadMiddleware = upload.single("file")

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // A Multer error occurred when uploading
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(ApiError.badRequest(`File size exceeds the limit of ${config.upload.maxSize / 1024 / 1024}MB`))
          }
          return next(ApiError.badRequest(err.message))
        }
        // An unknown error occurred
        return next(err)
      }

      try {
        // Check if file exists
        if (!req.file) {
          throw ApiError.badRequest("No file uploaded")
        }

        // Get user ID
        const userId = (req as any).user?._id

        // Parse options
        const options: any = {}
        if (req.body.folder) options.folder = req.body.folder
        if (req.body.alt) options.alt = req.body.alt
        if (req.body.title) options.title = req.body.title
        if (req.body.description) options.description = req.body.description

        // Parse tags
        if (req.body.tags) {
          try {
            options.tags = JSON.parse(req.body.tags)
          } catch (error) {
            // If tags is not valid JSON, treat it as a comma-separated string
            options.tags = req.body.tags.split(",").map((tag: string) => tag.trim())
          }
        }

        // Parse metadata
        if (req.body.metadata) {
          try {
            options.metadata = JSON.parse(req.body.metadata)
          } catch (error) {
            logger.warn("Invalid metadata JSON:", error)
          }
        }

        // Upload media
        const media = await this.mediaService.uploadMedia(
          {
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          },
          options,
          userId,
        )

        res.status(201).json({
          status: "success",
          data: {
            media,
          },
        })
      } catch (error) {
        next(error)
      }
    })
  }

  /**
   * Update media
   */
  public updateMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const media = await this.mediaService.updateMedia(id, req.body)

      res.status(200).json({
        status: "success",
        data: {
          media,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete media
   */
  public deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      await this.mediaService.deleteMedia(id)

      res.status(200).json({
        status: "success",
        data: null,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create folder
   */
  public createFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, parentFolder } = req.body
      const folderPath = await this.mediaService.createFolder(name, parentFolder)

      res.status(201).json({
        status: "success",
        data: {
          path: folderPath,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete folder
   */
  public deleteFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path } = req.params
      await this.mediaService.deleteFolder(path)

      res.status(200).json({
        status: "success",
        data: null,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * List folders
   */
  public listFolders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentFolder = (req.query.parent as string) || "/"
      const folders = await this.mediaService.listFolders(parentFolder)

      res.status(200).json({
        status: "success",
        data: {
          folders,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
