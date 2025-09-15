import { ContentTypeRepository } from "../db/repositories/content-type.repository"
import { ApiError } from "../utils/errors"
import type { IContentType, IField } from "../db/models/content-type.model"

export class ContentTypeService {
  private contentTypeRepository: ContentTypeRepository

  constructor() {
    this.contentTypeRepository = new ContentTypeRepository()
  }

  /**
   * Get all content types
   */
  async getAllContentTypes(
    filter: {
      search?: string
      isSystem?: boolean
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
    contentTypes: IContentType[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.search) {
      const regex = new RegExp(filter.search, "i")
      filterQuery.$or = [{ name: regex }, { displayName: regex }, { description: regex }]
    }

    if (filter.isSystem !== undefined) {
      filterQuery.isSystem = filter.isSystem
    }

    // Build sort
    const sortQuery: any = {}
    if (sort.field) {
      sortQuery[sort.field] = sort.direction === "desc" ? -1 : 1
    } else {
      sortQuery.createdAt = -1 // Default sort by creation date descending
    }

    // Get paginated results
    const result = await this.contentTypeRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: sortQuery,
    })

    return {
      contentTypes: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get content type by ID
   */
  async getContentTypeById(id: string): Promise<IContentType> {
    return this.contentTypeRepository.findByIdOrThrow(id)
  }

  /**
   * Get content type by name
   */
  async getContentTypeByName(name: string): Promise<IContentType> {
    return this.contentTypeRepository.findByNameOrThrow(name)
  }

  /**
   * Create a new content type
   */
  async createContentType(data: {
    name: string
    displayName: string
    description?: string
    fields: Omit<IField, "_id" | "isSystem">[]
  }): Promise<IContentType> {
    // Check if content type with this name already exists
    const exists = await this.contentTypeRepository.existsByName(data.name)
    if (exists) {
      throw ApiError.conflict(`Content type with name '${data.name}' already exists`)
    }

    // Validate field names
    this.validateFieldNames(data.fields)

    // Create content type
    return this.contentTypeRepository.create({
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      fields: data.fields.map((field) => ({
        ...field,
        isSystem: false,
      })),
      isSystem: false,
    })
  }

  /**
   * Update a content type
   */
  async updateContentType(
    id: string,
    data: {
      displayName?: string
      description?: string
      fields?: Omit<IField, "_id" | "isSystem">[]
    },
  ): Promise<IContentType> {
    const contentType = await this.contentTypeRepository.findByIdOrThrow(id)

    // Check if content type is a system content type
    if (contentType.isSystem) {
      throw ApiError.forbidden("Cannot modify system content types")
    }

    // Validate field names if fields are provided
    if (data.fields) {
      this.validateFieldNames(data.fields)
    }

    // Update content type
    const updateData: any = {}
    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.description !== undefined) updateData.description = data.description
    if (data.fields !== undefined) {
      updateData.fields = data.fields.map((field) => ({
        ...field,
        isSystem: false,
      }))
    }

    return this.contentTypeRepository.updateByIdOrThrow(id, updateData)
  }

  /**
   * Delete a content type
   */
  async deleteContentType(id: string): Promise<void> {
    const contentType = await this.contentTypeRepository.findByIdOrThrow(id)

    // Check if content type is a system content type
    if (contentType.isSystem) {
      throw ApiError.forbidden("Cannot delete system content types")
    }

    // Delete content type
    await this.contentTypeRepository.deleteByIdOrThrow(id)
  }

  /**
   * Add a field to a content type
   */
  async addField(contentTypeId: string, field: Omit<IField, "_id" | "isSystem">): Promise<IContentType> {
    const contentType = await this.contentTypeRepository.findByIdOrThrow(contentTypeId)

    // Check if content type is a system content type
    if (contentType.isSystem) {
      throw ApiError.forbidden("Cannot modify system content types")
    }

    // Validate field name
    this.validateFieldName(field.name)

    // Check if field name already exists
    const fieldExists = contentType.fields.some((f) => f.name === field.name)
    if (fieldExists) {
      throw ApiError.conflict(`Field with name '${field.name}' already exists in this content type`)
    }

    // Add field
    return this.contentTypeRepository.addField(contentTypeId, {
      ...field,
      isSystem: false,
    } as IField)
  }

  /**
   * Update a field in a content type
   */
  async updateField(
    contentTypeId: string,
    fieldId: string,
    fieldData: Partial<Omit<IField, "_id" | "isSystem" | "name">>,
  ): Promise<IContentType> {
    const contentType = await this.contentTypeRepository.findByIdOrThrow(contentTypeId)

    // Check if content type is a system content type
    if (contentType.isSystem) {
      throw ApiError.forbidden("Cannot modify system content types")
    }

    // Find the field
    const field = contentType.fields.find((f) => f._id.toString() === fieldId)
    if (!field) {
      throw ApiError.notFound(`Field not found with ID: ${fieldId}`)
    }

    // Check if field is a system field
    if (field.isSystem) {
      throw ApiError.forbidden("Cannot modify system fields")
    }

    // Update field
    return this.contentTypeRepository.updateField(contentTypeId, fieldId, fieldData)
  }

  /**
   * Remove a field from a content type
   */
  async removeField(contentTypeId: string, fieldId: string): Promise<IContentType> {
    const contentType = await this.contentTypeRepository.findByIdOrThrow(contentTypeId)

    // Check if content type is a system content type
    if (contentType.isSystem) {
      throw ApiError.forbidden("Cannot modify system content types")
    }

    // Find the field
    const field = contentType.fields.find((f) => f._id.toString() === fieldId)
    if (!field) {
      throw ApiError.notFound(`Field not found with ID: ${fieldId}`)
    }

    // Check if field is a system field
    if (field.isSystem) {
      throw ApiError.forbidden("Cannot remove system fields")
    }

    // Remove field
    return this.contentTypeRepository.removeField(contentTypeId, fieldId)
  }

  /**
   * Validate field names
   */
  private validateFieldNames(fields: { name: string }[]): void {
    // Check for duplicate field names
    const fieldNames = fields.map((field) => field.name)
    const uniqueFieldNames = new Set(fieldNames)
    if (uniqueFieldNames.size !== fieldNames.length) {
      throw ApiError.badRequest("Duplicate field names are not allowed")
    }

    // Validate each field name
    fields.forEach((field) => this.validateFieldName(field.name))
  }

  /**
   * Validate field name
   */
  private validateFieldName(name: string): void {
    // Field name should be alphanumeric with underscores and hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw ApiError.badRequest("Field name can only contain alphanumeric characters, underscores, and hyphens")
    }

    // Field name should not start with a number
    if (/^[0-9]/.test(name)) {
      throw ApiError.badRequest("Field name cannot start with a number")
    }

    // Field name should not be a reserved name
    const reservedNames = ["id", "_id", "createdAt", "updatedAt", "contentType", "status", "locale"]
    if (reservedNames.includes(name)) {
      throw ApiError.badRequest(`Field name '${name}' is reserved and cannot be used`)
    }
  }
}
