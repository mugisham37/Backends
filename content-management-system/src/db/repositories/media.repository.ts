import { BaseRepository } from "./base.repository"
import { MediaModel, type IMedia, type MediaType } from "../models/media.model"

export class MediaRepository extends BaseRepository<IMedia> {
  constructor() {
    super(MediaModel)
  }

  /**
   * Find media by type
   */
  async findByType(type: MediaType): Promise<IMedia[]> {
    return this.find({ type })
  }

  /**
   * Find media by MIME type
   */
  async findByMimeType(mimeType: string): Promise<IMedia[]> {
    // Use regex to match MIME type pattern (e.g., "image/*")
    const regex = new RegExp(`^${mimeType.replace("*", ".*")}$`)
    return this.find({ mimeType: regex })
  }

  /**
   * Find media by folder
   */
  async findByFolder(folder: string): Promise<IMedia[]> {
    return this.find({ folder })
  }

  /**
   * Find media by tags
   */
  async findByTags(tags: string[]): Promise<IMedia[]> {
    return this.find({ tags: { $in: tags } })
  }

  /**
   * Find media by creator
   */
  async findByCreator(userId: string): Promise<IMedia[]> {
    return this.find({ createdBy: userId })
  }

  /**
   * Search media
   */
  async search(query: string): Promise<IMedia[]> {
    const regex = new RegExp(query, "i")
    return this.find({
      $or: [
        { filename: regex },
        { originalFilename: regex },
        { title: regex },
        { description: regex },
        { alt: regex },
        { tags: regex },
      ],
    })
  }

  /**
   * Update media metadata
   */
  async updateMetadata(mediaId: string, metadata: any): Promise<IMedia> {
    return this.updateByIdOrThrow(mediaId, { metadata })
  }

  /**
   * Add tags to media
   */
  async addTags(mediaId: string, tags: string[]): Promise<IMedia> {
    const media = await this.findByIdOrThrow(mediaId)

    // Add new tags (avoid duplicates)
    const currentTags = media.tags || []
    const uniqueTags = [...new Set([...currentTags, ...tags])]

    return this.updateById(mediaId, { tags: uniqueTags }) as Promise<IMedia>
  }

  /**
   * Remove tags from media
   */
  async removeTags(mediaId: string, tags: string[]): Promise<IMedia> {
    const media = await this.findByIdOrThrow(mediaId)

    // Remove specified tags
    const currentTags = media.tags || []
    const updatedTags = currentTags.filter((tag) => !tags.includes(tag))

    return this.updateById(mediaId, { tags: updatedTags }) as Promise<IMedia>
  }

  /**
   * Move media to a different folder
   */
  async moveToFolder(mediaId: string, folder: string): Promise<IMedia> {
    return this.updateByIdOrThrow(mediaId, { folder })
  }

  /**
   * Find media created within a date range
   */
  async findByCreationDate(startDate: Date, endDate: Date): Promise<IMedia[]> {
    return this.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
  }

  /**
   * Find media by size range (in bytes)
   */
  async findBySizeRange(minSize: number, maxSize: number): Promise<IMedia[]> {
    return this.find({
      size: {
        $gte: minSize,
        $lte: maxSize,
      },
    })
  }
}
