import { BaseRepository } from "./base.repository"
import { ContentTypeModel, type IContentType, type IField } from "../models/content-type.model"
import { ApiError } from "../../utils/errors"

export class ContentTypeRepository extends BaseRepository<IContentType> {
  constructor() {
    super(ContentTypeModel)
  }

  /**
   * Find a content type by name
   */
  async findByName(name: string): Promise<IContentType | null> {
    return this.findOne({ name })
  }

  /**
   * Find a content type by name or throw an error if not found
   */
  async findByNameOrThrow(name: string): Promise<IContentType> {
    const contentType = await this.findByName(name)
    if (!contentType) {
      throw ApiError.notFound(`Content type not found with name: ${name}`)
    }
    return contentType
  }

  /**
   * Check if a content type exists with the given name
   */
  async existsByName(name: string): Promise<boolean> {
    const count = await this.count({ name })
    return count > 0
  }

  /**
   * Find system content types
   */
  async findSystemContentTypes(): Promise<IContentType[]> {
    return this.find({ isSystem: true })
  }

  /**
   * Find non-system content types
   */
  async findNonSystemContentTypes(): Promise<IContentType[]> {
    return this.find({ isSystem: false })
  }

  /**
   * Add a field to a content type
   */
  async addField(contentTypeId: string, field: IField): Promise<IContentType> {
    const contentType = await this.findByIdOrThrow(contentTypeId)

    // Check if field name already exists
    const fieldExists = contentType.fields.some((f) => f.name === field.name)
    if (fieldExists) {
      throw ApiError.conflict(`Field with name '${field.name}' already exists in this content type`)
    }

    // Add the field
    contentType.fields.push(field as any)
    await contentType.save()

    return contentType
  }

  /**
   * Update a field in a content type
   */
  async updateField(contentTypeId: string, fieldId: string, fieldData: Partial<IField>): Promise<IContentType> {
    const contentType = await this.findByIdOrThrow(contentTypeId)

    // Find the field index
    const fieldIndex = contentType.fields.findIndex((f) => f._id.toString() === fieldId)
    if (fieldIndex === -1) {
      throw ApiError.notFound(`Field not found with ID: ${fieldId}`)
    }

    // Check if field is a system field
    if (contentType.fields[fieldIndex].isSystem) {
      throw ApiError.forbidden("Cannot modify system fields")
    }

    // Update the field
    Object.assign(contentType.fields[fieldIndex], fieldData)
    await contentType.save()

    return contentType
  }

  /**
   * Remove a field from a content type
   */
  async removeField(contentTypeId: string, fieldId: string): Promise<IContentType> {
    const contentType = await this.findByIdOrThrow(contentTypeId)

    // Find the field
    const field = contentType.fields.find((f) => f._id.toString() === fieldId)
    if (!field) {
      throw ApiError.notFound(`Field not found with ID: ${fieldId}`)
    }

    // Check if field is a system field
    if (field.isSystem) {
      throw ApiError.forbidden("Cannot remove system fields")
    }

    // Remove the field
    contentType.fields = contentType.fields.filter((f) => f._id.toString() !== fieldId)
    await contentType.save()

    return contentType
  }

  /**
   * Search content types
   */
  async search(query: string): Promise<IContentType[]> {
    const regex = new RegExp(query, "i")
    return this.find({
      $or: [{ name: regex }, { displayName: regex }, { description: regex }],
    })
  }
}
