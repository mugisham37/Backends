import path from "path"
import fs from "fs/promises"
import { v4 as uuidv4 } from "uuid"
import { MediaRepository } from "../db/repositories/media.repository"
import { ApiError } from "../utils/errors"
import { MediaType } from "../db/models/media.model"
import { config } from "../config"
import { logger } from "../utils/logger"

export class MediaService {
  private mediaRepository: MediaRepository
  private uploadDir: string

  constructor() {
    this.mediaRepository = new MediaRepository()
    this.uploadDir = path.resolve(process.cwd(), config.upload.directory || "uploads")
    this.ensureUploadDirExists()
  }

  /**
   * Get all media items
   */
  async getAllMedia(
    filter: {
      type?: MediaType
      search?: string
      mimeType?: string
      folder?: string
      tags?: string[]
      createdBy?: string
      createdAt?: { from?: Date; to?: Date }
    } = {},
    sort: {
      field?: string
      direction?: "asc" | "desc"
    } = {},
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    media: any[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.type) {
      filterQuery.type = filter.type
    }

    if (filter.mimeType) {
      // Handle MIME type patterns (e.g., "image/*")
      if (filter.mimeType.includes("*")) {
        const pattern = filter.mimeType.replace("*", ".*")
        filterQuery.mimeType = { $regex: new RegExp(`^${pattern}$`) }
      } else {
        filterQuery.mimeType = filter.mimeType
      }
    }

    if (filter.folder) {
      filterQuery.folder = filter.folder
    }

    if (filter.tags && filter.tags.length > 0) {
      filterQuery.tags = { $in: filter.tags }
    }

    if (filter.createdBy) {
      filterQuery.createdBy = filter.createdBy
    }

    if (filter.createdAt?.from || filter.createdAt?.to) {
      filterQuery.createdAt = {}
      if (filter.createdAt.from) {
        filterQuery.createdAt.$gte = filter.createdAt.from
      }
      if (filter.createdAt.to) {
        filterQuery.createdAt.$lte = filter.createdAt.to
      }
    }

    if (filter.search) {
      const regex = new RegExp(filter.search, "i")
      filterQuery.$or = [
        { filename: regex },
        { originalFilename: regex },
        { title: regex },
        { description: regex },
        { alt: regex },
        { tags: regex },
      ]
    }

    // Build sort
    const sortQuery: any = {}
    if (sort.field) {
      sortQuery[sort.field] = sort.direction === "desc" ? -1 : 1
    } else {
      sortQuery.createdAt = -1 // Default sort by creation date descending
    }

    // Get paginated results with populated references
    const result = await this.mediaRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: sortQuery,
      populate: ["createdBy"],
    })

    return {
      media: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(id: string): Promise<any> {
    const media = await this.mediaRepository.findByIdOrThrow(id)

    // Populate references
    await media.populate({ path: "createdBy", select: "-password" })

    return media
  }

  /**
   * Upload media
   */
  async uploadMedia(
    file: {
      buffer: Buffer
      originalname: string
      mimetype: string
      size: number
    },
    options: {
      folder?: string
      metadata?: any
      alt?: string
      title?: string
      description?: string
      tags?: string[]
    } = {},
    userId?: string,
  ): Promise<any> {
    // Validate file
    this.validateFile(file)

    // Determine media type
    const type = this.getMediaType(file.mimetype)

    // Generate unique filename
    const extension = path.extname(file.originalname)
    const filename = `${uuidv4()}${extension}`

    // Determine folder path
    const folder = options.folder || "/"
    const folderPath = path.join(this.uploadDir, folder)

    // Ensure folder exists
    await this.ensureFolderExists(folderPath)

    // Save file
    const filePath = path.join(folderPath, filename)
    await fs.writeFile(filePath, file.buffer)

    // Generate URLs
    const url = this.getFileUrl(folder, filename)
    let thumbnailUrl: string | undefined

    // Generate thumbnail for images
    if (type === MediaType.IMAGE) {
      thumbnailUrl = await this.generateThumbnail(filePath, folder, filename)
    }

    // Extract metadata
    const metadata = await this.extractMetadata(file, type, options.metadata)

    // Create media record
    const media = await this.mediaRepository.create({
      filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      type,
      size: file.size,
      url,
      thumbnailUrl,
      metadata,
      alt: options.alt,
      title: options.title || file.originalname,
      description: options.description,
      tags: options.tags,
      folder,
      createdBy: userId,
    })

    // Populate references
    if (userId) {
      await media.populate({ path: "createdBy", select: "-password" })
    }

    return media
  }

  /**
   * Update media
   */
  async updateMedia(
    id: string,
    data: {
      alt?: string
      title?: string
      description?: string
      tags?: string[]
      folder?: string
    },
  ): Promise<any> {
    // Get media
    const media = await this.mediaRepository.findByIdOrThrow(id)

    // If folder is being changed, move the file
    if (data.folder && data.folder !== media.folder) {
      await this.moveMediaFile(media, data.folder)
    }

    // Update media
    const updatedMedia = await this.mediaRepository.updateByIdOrThrow(id, data)

    // Populate references
    await updatedMedia.populate({ path: "createdBy", select: "-password" })

    return updatedMedia
  }

  /**
   * Delete media
   */
  async deleteMedia(id: string): Promise<void> {
    // Get media
    const media = await this.mediaRepository.findByIdOrThrow(id)

    // Delete file
    const filePath = path.join(this.uploadDir, media.folder, media.filename)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      logger.warn(`Failed to delete file: ${filePath}`, error)
    }

    // Delete thumbnail if exists
    if (media.thumbnailUrl) {
      const thumbnailPath = this.getFilePathFromUrl(media.thumbnailUrl)
      try {
        await fs.unlink(thumbnailPath)
      } catch (error) {
        logger.warn(`Failed to delete thumbnail: ${thumbnailPath}`, error)
      }
    }

    // Delete media record
    await this.mediaRepository.deleteByIdOrThrow(id)
  }

  /**
   * Create folder
   */
  async createFolder(name: string, parentFolder = "/"): Promise<string> {
    // Validate folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw ApiError.badRequest("Folder name can only contain alphanumeric characters, underscores, and hyphens")
    }

    // Normalize parent folder path
    const normalizedParent = parentFolder.endsWith("/") ? parentFolder : `${parentFolder}/`

    // Create folder path
    const folderPath = path.join(normalizedParent, name)

    // Create folder in filesystem
    const fullPath = path.join(this.uploadDir, folderPath)
    await this.ensureFolderExists(fullPath)

    return folderPath
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderPath: string): Promise<void> {
    // Prevent deleting root folder
    if (folderPath === "/" || !folderPath) {
      throw ApiError.forbidden("Cannot delete root folder")
    }

    // Check if folder exists
    const fullPath = path.join(this.uploadDir, folderPath)
    try {
      await fs.access(fullPath)
    } catch (error) {
      throw ApiError.notFound(`Folder not found: ${folderPath}`)
    }

    // Check if folder is empty
    const files = await fs.readdir(fullPath)
    if (files.length > 0) {
      throw ApiError.conflict("Cannot delete non-empty folder")
    }

    // Delete folder
    await fs.rmdir(fullPath)
  }

  /**
   * List folders
   */
  async listFolders(parentFolder = "/"): Promise<string[]> {
    const fullPath = path.join(this.uploadDir, parentFolder)

    try {
      // Get all items in the directory
      const items = await fs.readdir(fullPath, { withFileTypes: true })

      // Filter for directories only
      const folders = items.filter((item) => item.isDirectory()).map((item) => item.name)

      return folders
    } catch (error) {
      throw ApiError.notFound(`Folder not found: ${parentFolder}`)
    }
  }

  /**
   * Validate file
   */
  private validateFile(file: { mimetype: string; size: number }): void {
    // Check file size
    if (file.size > config.upload.maxSize) {
      throw ApiError.badRequest(`File size exceeds the limit of ${config.upload.maxSize / 1024 / 1024}MB`)
    }

    // Check MIME type
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
        throw ApiError.badRequest(`File type not allowed: ${file.mimetype}`)
      }
    }
  }

  /**
   * Get media type from MIME type
   */
  private getMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith("image/")) {
      return MediaType.IMAGE
    } else if (mimeType.startsWith("video/")) {
      return MediaType.VIDEO
    } else if (mimeType.startsWith("audio/")) {
      return MediaType.AUDIO
    } else if (
      mimeType === "application/pdf" ||
      mimeType.startsWith("application/vnd.openxmlformats-officedocument.") ||
      mimeType.startsWith("application/vnd.ms-")
    ) {
      return MediaType.DOCUMENT
    } else {
      return MediaType.OTHER
    }
  }

  /**
   * Get file URL
   */
  private getFileUrl(folder: string, filename: string): string {
    const normalizedFolder = folder.startsWith("/") ? folder : `/${folder}`
    const folderPath = normalizedFolder.endsWith("/") ? normalizedFolder : `${normalizedFolder}/`
    return `${config.upload.baseUrl || ""}${folderPath}${filename}`
  }

  /**
   * Get file path from URL
   */
  private getFilePathFromUrl(url: string): string {
    const baseUrl = config.upload.baseUrl || ""
    const relativePath = url.replace(baseUrl, "")
    return path.join(this.uploadDir, relativePath)
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(filePath: string, folder: string, filename: string): Promise<string | undefined> {
    try {
      // In a real implementation, you would use a library like sharp to generate thumbnails
      // For this example, we'll just return undefined
      // const thumbnailFilename = `thumb_${filename}`;
      // const thumbnailPath = path.join(this.uploadDir, folder, thumbnailFilename);
      // await sharp(filePath)
      //   .resize(200, 200, { fit: 'inside' })
      //   .toFile(thumbnailPath);
      // return this.getFileUrl(folder, thumbnailFilename);
      return undefined
    } catch (error) {
      logger.warn("Failed to generate thumbnail", error)
      return undefined
    }
  }

  /**
   * Extract metadata from file
   */
  private async extractMetadata(
    file: { buffer: Buffer; mimetype: string; size: number },
    type: MediaType,
    customMetadata?: any,
  ): Promise<any> {
    // In a real implementation, you would use libraries like sharp, exif-parser, etc.
    // to extract metadata from different file types
    const metadata: any = {
      size: file.size,
    }

    // Merge with custom metadata
    if (customMetadata) {
      Object.assign(metadata, customMetadata)
    }

    return metadata
  }

  /**
   * Move media file to a different folder
   */
  private async moveMediaFile(media: any, newFolder: string): Promise<void> {
    // Create source and destination paths
    const sourcePath = path.join(this.uploadDir, media.folder, media.filename)
    const destFolder = path.join(this.uploadDir, newFolder)
    const destPath = path.join(destFolder, media.filename)

    // Ensure destination folder exists
    await this.ensureFolderExists(destFolder)

    // Move file
    await fs.rename(sourcePath, destPath)

    // Update URL
    media.url = this.getFileUrl(newFolder, media.filename)

    // Move thumbnail if exists
    if (media.thumbnailUrl) {
      const thumbnailFilename = path.basename(media.thumbnailUrl)
      const thumbnailSourcePath = path.join(this.uploadDir, media.folder, thumbnailFilename)
      const thumbnailDestPath = path.join(destFolder, thumbnailFilename)

      try {
        await fs.rename(thumbnailSourcePath, thumbnailDestPath)
        media.thumbnailUrl = this.getFileUrl(newFolder, thumbnailFilename)
      } catch (error) {
        logger.warn(`Failed to move thumbnail: ${thumbnailSourcePath}`, error)
      }
    }

    // Update folder
    media.folder = newFolder
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirExists(): Promise<void> {
    try {
      await fs.access(this.uploadDir)
    } catch (error) {
      await fs.mkdir(this.uploadDir, { recursive: true })
    }
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    try {
      await fs.access(folderPath)
    } catch (error) {
      await fs.mkdir(folderPath, { recursive: true })
    }
  }
}
