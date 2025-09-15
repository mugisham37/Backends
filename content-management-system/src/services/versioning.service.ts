import mongoose from "mongoose"
import { ContentModel } from "../db/models/content.model"
import { ContentVersionModel, type IContentVersion } from "../db/models/content-version.model"
import { logger } from "../utils/logger"
import { ApiError } from "../utils/errors"

export class VersioningService {
  /**
   * Create a new version of content
   */
  async createVersion(
    contentId: string,
    data: any,
    options: {
      userId: string
      notes?: string
      status?: "draft" | "published" | "archived"
    },
  ): Promise<IContentVersion> {
    try {
      // Validate content exists
      const content = await ContentModel.findById(contentId)
      if (!content) {
        throw ApiError.notFound(`Content with ID ${contentId} not found`)
      }

      // Get the latest version number
      const latestVersion = await ContentVersionModel.findOne({ contentId }, {}, { sort: { version: -1 } })
      const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1

      // Create new version
      const contentVersion = new ContentVersionModel({
        contentId,
        version: newVersionNumber,
        data,
        status: options.status || "draft",
        createdBy: options.userId,
        notes: options.notes,
        ...(options.status === "published" && {
          publishedAt: new Date(),
          publishedBy: options.userId,
        }),
      })

      await contentVersion.save()

      // If this is a published version, update the content's current data
      if (options.status === "published") {
        await ContentModel.findByIdAndUpdate(contentId, {
          data,
          status: "published",
          publishedAt: new Date(),
          publishedBy: options.userId,
          currentVersion: newVersionNumber,
        })
      }

      return contentVersion
    } catch (error) {
      logger.error("Failed to create content version:", error)
      throw error
    }
  }

  /**
   * Get all versions of a content
   */
  async getContentVersions(
    contentId: string,
    options: {
      page?: number
      limit?: number
      status?: "draft" | "published" | "archived"
    } = {},
  ): Promise<{
    versions: IContentVersion[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    try {
      const page = options.page || 1
      const limit = options.limit || 20
      const skip = (page - 1) * limit

      // Build query
      const query: any = { contentId }
      if (options.status) {
        query.status = options.status
      }

      // Execute query
      const [versions, totalCount] = await Promise.all([
        ContentVersionModel.find(query)
          .sort({ version: -1 })
          .skip(skip)
          .limit(limit)
          .populate("createdBy", "firstName lastName email")
          .populate("publishedBy", "firstName lastName email"),
        ContentVersionModel.countDocuments(query),
      ])

      const totalPages = Math.ceil(totalCount / limit)

      return {
        versions,
        totalCount,
        page,
        totalPages,
      }
    } catch (error) {
      logger.error("Failed to get content versions:", error)
      throw error
    }
  }

  /**
   * Get a specific version of content
   */
  async getContentVersion(contentId: string, version: number): Promise<IContentVersion | null> {
    try {
      return ContentVersionModel.findOne({ contentId, version })
        .populate("createdBy", "firstName lastName email")
        .populate("publishedBy", "firstName lastName email")
    } catch (error) {
      logger.error("Failed to get content version:", error)
      throw error
    }
  }

  /**
   * Get the latest version of content
   */
  async getLatestVersion(
    contentId: string,
    options: { status?: "draft" | "published" | "archived" } = {},
  ): Promise<IContentVersion | null> {
    try {
      const query: any = { contentId }
      if (options.status) {
        query.status = options.status
      }

      return ContentVersionModel.findOne(query, {}, { sort: { version: -1 } })
        .populate("createdBy", "firstName lastName email")
        .populate("publishedBy", "firstName lastName email")
    } catch (error) {
      logger.error("Failed to get latest content version:", error)
      throw error
    }
  }

  /**
   * Publish a specific version
   */
  async publishVersion(contentId: string, version: number, userId: string): Promise<IContentVersion> {
    try {
      // Find the version
      const contentVersion = await ContentVersionModel.findOne({ contentId, version })
      if (!contentVersion) {
        throw ApiError.notFound(`Version ${version} of content ${contentId} not found`)
      }

      // Update version status
      contentVersion.status = "published"
      contentVersion.publishedAt = new Date()
      contentVersion.publishedBy = new mongoose.Types.ObjectId(userId)
      await contentVersion.save()

      // Update content
      await ContentModel.findByIdAndUpdate(contentId, {
        data: contentVersion.data,
        status: "published",
        publishedAt: new Date(),
        publishedBy: userId,
        currentVersion: version,
      })

      return contentVersion
    } catch (error) {
      logger.error("Failed to publish content version:", error)
      throw error
    }
  }

  /**
   * Revert to a specific version
   */
  async revertToVersion(
    contentId: string,
    version: number,
    options: {
      userId: string
      notes?: string
      publish?: boolean
    },
  ): Promise<IContentVersion> {
    try {
      // Find the version to revert to
      const targetVersion = await ContentVersionModel.findOne({ contentId, version })
      if (!targetVersion) {
        throw ApiError.notFound(`Version ${version} of content ${contentId} not found`)
      }

      // Create a new version with the data from the target version
      return this.createVersion(contentId, targetVersion.data, {
        userId: options.userId,
        notes: options.notes || `Reverted to version ${version}`,
        status: options.publish ? "published" : "draft",
      })
    } catch (error) {
      logger.error("Failed to revert to content version:", error)
      throw error
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(contentId: string, versionA: number, versionB: number): Promise<any> {
    try {
      // Get both versions
      const [versionADoc, versionBDoc] = await Promise.all([
        ContentVersionModel.findOne({ contentId, version: versionA }),
        ContentVersionModel.findOne({ contentId, version: versionB }),
      ])

      if (!versionADoc || !versionBDoc) {
        throw ApiError.notFound("One or both versions not found")
      }

      // Simple diff implementation
      // In a real-world scenario, you might want to use a more sophisticated diff algorithm
      const dataA = versionADoc.data
      const dataB = versionBDoc.data

      // Compare fields
      const allFields = new Set([...Object.keys(dataA || {}), ...Object.keys(dataB || {})])
      const differences: any = {}

      allFields.forEach((field) => {
        const valueA = dataA?.[field]
        const valueB = dataB?.[field]

        if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
          differences[field] = {
            versionA: valueA,
            versionB: valueB,
          }
        }
      })

      return {
        versionA: {
          version: versionADoc.version,
          createdAt: versionADoc.createdAt,
          status: versionADoc.status,
        },
        versionB: {
          version: versionBDoc.version,
          createdAt: versionBDoc.createdAt,
          status: versionBDoc.status,
        },
        differences,
        hasDifferences: Object.keys(differences).length > 0,
      }
    } catch (error) {
      logger.error("Failed to compare content versions:", error)
      throw error
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(contentId: string, version: number): Promise<void> {
    try {
      // Check if this is the only version
      const count = await ContentVersionModel.countDocuments({ contentId })
      if (count <= 1) {
        throw ApiError.badRequest("Cannot delete the only version of content")
      }

      // Check if this is the published version
      const content = await ContentModel.findById(contentId)
      if (content && content.currentVersion === version) {
        throw ApiError.badRequest("Cannot delete the currently published version")
      }

      // Delete the version
      const result = await ContentVersionModel.deleteOne({ contentId, version })
      if (result.deletedCount === 0) {
        throw ApiError.notFound(`Version ${version} of content ${contentId} not found`)
      }
    } catch (error) {
      logger.error("Failed to delete content version:", error)
      throw error
    }
  }

  /**
   * Delete all versions of a content
   */
  async deleteAllVersions(contentId: string): Promise<number> {
    try {
      const result = await ContentVersionModel.deleteMany({ contentId })
      return result.deletedCount || 0
    } catch (error) {
      logger.error("Failed to delete all content versions:", error)
      throw error
    }
  }
}

// Export singleton instance
export const versioningService = new VersioningService()
