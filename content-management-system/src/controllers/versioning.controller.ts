import type { Request, Response, NextFunction } from "express"
import { versioningService } from "../services/versioning.service"
import { parsePaginationParams } from "../utils/helpers"

export class VersioningController {
  /**
   * Create a new version
   */
  public createVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params
      const { data, notes, status } = req.body
      const userId = (req as any).user._id

      const version = await versioningService.createVersion(contentId, data, {
        userId,
        notes,
        status,
      })

      res.status(201).json({
        status: "success",
        data: {
          version,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all versions of a content
   */
  public getContentVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params
      const { page, limit } = parsePaginationParams(req.query)
      const status = req.query.status as "draft" | "published" | "archived" | undefined

      const result = await versioningService.getContentVersions(contentId, {
        page,
        limit,
        status,
      })

      res.status(200).json({
        status: "success",
        data: {
          versions: result.versions,
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
   * Get a specific version
   */
  public getContentVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, version } = req.params
      const versionNumber = Number.parseInt(version, 10)

      const contentVersion = await versioningService.getContentVersion(contentId, versionNumber)

      if (!contentVersion) {
        return res.status(404).json({
          status: "error",
          message: `Version ${version} of content ${contentId} not found`,
        })
      }

      res.status(200).json({
        status: "success",
        data: {
          version: contentVersion,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get the latest version
   */
  public getLatestVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params
      const status = req.query.status as "draft" | "published" | "archived" | undefined

      const contentVersion = await versioningService.getLatestVersion(contentId, { status })

      if (!contentVersion) {
        return res.status(404).json({
          status: "error",
          message: `No versions found for content ${contentId}`,
        })
      }

      res.status(200).json({
        status: "success",
        data: {
          version: contentVersion,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Publish a version
   */
  public publishVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, version } = req.params
      const versionNumber = Number.parseInt(version, 10)
      const userId = (req as any).user._id

      const contentVersion = await versioningService.publishVersion(contentId, versionNumber, userId)

      res.status(200).json({
        status: "success",
        data: {
          version: contentVersion,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Revert to a version
   */
  public revertToVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, version } = req.params
      const versionNumber = Number.parseInt(version, 10)
      const { notes, publish } = req.body
      const userId = (req as any).user._id

      const contentVersion = await versioningService.revertToVersion(contentId, versionNumber, {
        userId,
        notes,
        publish,
      })

      res.status(200).json({
        status: "success",
        data: {
          version: contentVersion,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Compare versions
   */
  public compareVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params
      const { versionA, versionB } = req.query
      const versionANumber = Number.parseInt(versionA as string, 10)
      const versionBNumber = Number.parseInt(versionB as string, 10)

      if (isNaN(versionANumber) || isNaN(versionBNumber)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid version numbers",
        })
      }

      const comparison = await versioningService.compareVersions(contentId, versionANumber, versionBNumber)

      res.status(200).json({
        status: "success",
        data: comparison,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete a version
   */
  public deleteVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, version } = req.params
      const versionNumber = Number.parseInt(version, 10)

      await versioningService.deleteVersion(contentId, versionNumber)

      res.status(200).json({
        status: "success",
        message: `Version ${version} of content ${contentId} deleted successfully`,
      })
    } catch (error) {
      next(error)
    }
  }
}
