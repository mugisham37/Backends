import { ContentRepository } from "../db/repositories/content.repository"
import { ContentTypeRepository } from "../db/repositories/content-type.repository"
import { ApiError } from "../utils/errors"
import { ContentStatus } from "../db/models/content.model"
import { FieldType } from "../db/models/content-type.model"
import { slugify } from "../utils/helpers"

export class ContentService {
  private contentRepository: ContentRepository
  private contentTypeRepository: ContentTypeRepository

  constructor() {
    this.contentRepository = new ContentRepository()
    this.contentTypeRepository = new ContentTypeRepository()
  }

  /**
   * Get all content items
   */
  async getAllContent(
    filter: {
      contentTypeId?: string
      status?: ContentStatus
      locale?: string
      search?: string
      createdBy?: string
      updatedBy?: string
      publishedBy?: string
      createdAt?: { from?: Date; to?: Date }
      updatedAt?: { from?: Date; to?: Date }
      publishedAt?: { from?: Date; to?: Date }
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
    content: any[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.contentTypeId) {
      filterQuery.contentType = filter.contentTypeId
    }

    if (filter.status) {
      filterQuery.status = filter.status
    }

    if (filter.locale) {
      filterQuery.locale = filter.locale
    }

    if (filter.createdBy) {
      filterQuery.createdBy = filter.createdBy
    }

    if (filter.updatedBy) {
      filterQuery.updatedBy = filter.updatedBy
    }

    if (filter.publishedBy) {
      filterQuery.publishedBy = filter.publishedBy
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

    if (filter.updatedAt?.from || filter.updatedAt?.to) {
      filterQuery.updatedAt = {}
      if (filter.updatedAt.from) {
        filterQuery.updatedAt.$gte = filter.updatedAt.from
      }
      if (filter.updatedAt.to) {
        filterQuery.updatedAt.$lte = filter.updatedAt.to
      }
    }

    if (filter.publishedAt?.from || filter.publishedAt?.to) {
      filterQuery.publishedAt = {}
      if (filter.publishedAt.from) {
        filterQuery.publishedAt.$gte = filter.publishedAt.from
      }
      if (filter.publishedAt.to) {
        filterQuery.publishedAt.$lte = filter.publishedAt.to
      }
    }

    if (filter.search) {
      // Simple search implementation
      // For production, consider using MongoDB text indexes or Elasticsearch
      const regex = new RegExp(filter.search, "i")
      filterQuery.$or = [
        { "data.title": regex },
        { "data.name": regex },
        { "data.description": regex },
        { slug: regex },
      ]
    }

    // Build sort
    const sortQuery: any = {}
    if (sort.field) {
      // Handle sorting by data fields
      if (sort.field.startsWith("data.")) {
        sortQuery[sort.field] = sort.direction === "desc" ? -1 : 1
      } else {
        sortQuery[sort.field] = sort.direction === "desc" ? -1 : 1
      }
    } else {
      sortQuery.updatedAt = -1 // Default sort by update date descending
    }

    // Get paginated results with populated references
    const result = await this.contentRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: sortQuery,
      populate: ["contentType", "createdBy", "updatedBy", "publishedBy"],
    })

    return {
      content: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(id: string): Promise<any> {
    const content = await this.contentRepository.findById(id)
    if (!content) {
      throw ApiError.notFound(`Content not found with ID: ${id}`)
    }

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Get content by slug
   */
  async getContentBySlug(contentTypeId: string, slug: string, locale = "en"): Promise<any> {
    const content = await this.contentRepository.findBySlug(contentTypeId, slug, locale)
    if (!content) {
      throw ApiError.notFound(`Content not found with slug: ${slug}`)
    }

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Create new content
   */
  async createContent(
    data: {
      contentTypeId: string
      data: any
      status?: ContentStatus
      locale?: string
      slug?: string
    },
    userId?: string,
  ): Promise<any> {
    // Get content type
    const contentType = await this.contentTypeRepository.findByIdOrThrow(data.contentTypeId)

    // Validate data against content type
    const validatedData = await this.validateData(data.data, contentType)

    // Generate slug if not provided
    let slug = data.slug
    if (!slug && (validatedData.title || validatedData.name)) {
      slug = slugify(validatedData.title || validatedData.name)
    }

    // Check if slug is unique for this content type and locale
    if (slug) {
      const existingContent = await this.contentRepository.findBySlug(data.contentTypeId, slug, data.locale || "en")
      if (existingContent) {
        // Append a unique identifier to make the slug unique
        slug = `${slug}-${Date.now().toString().slice(-6)}`
      }
    }

    // Create content
    const content = await this.contentRepository.create({
      contentType: data.contentTypeId,
      data: validatedData,
      status: data.status || ContentStatus.DRAFT,
      locale: data.locale || "en",
      slug,
      createdBy: userId,
      updatedBy: userId,
    })

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Update content
   */
  async updateContent(
    id: string,
    data: {
      data?: any
      status?: ContentStatus
      slug?: string
      comment?: string
    },
    userId?: string,
  ): Promise<any> {
    // Get content
    const content = await this.contentRepository.findByIdOrThrow(id)

    // Get content type
    const contentType = await this.contentTypeRepository.findByIdOrThrow(content.contentType.toString())

    // Prepare update data
    const updateData: any = {
      updatedBy: userId,
    }

    // Validate and update data if provided
    if (data.data) {
      updateData.data = await this.validateData(data.data, contentType, content.data)
    }

    // Update status if provided
    if (data.status) {
      updateData.status = data.status
    }

    // Update slug if provided
    if (data.slug) {
      // Check if slug is unique for this content type and locale
      const existingContent = await this.contentRepository.findBySlug(
        content.contentType.toString(),
        data.slug,
        content.locale,
      )
      if (existingContent && existingContent._id.toString() !== id) {
        throw ApiError.conflict(`Content with slug '${data.slug}' already exists for this content type and locale`)
      }
      updateData.slug = data.slug
    }

    // Update content
    const updatedContent = await this.contentRepository.updateByIdOrThrow(id, updateData)

    // Add comment to the latest version if provided
    if (data.comment && updatedContent.versions.length > 0) {
      const latestVersion = updatedContent.versions[updatedContent.versions.length - 1]
      latestVersion.comment = data.comment
      await updatedContent.save()
    }

    // Populate references
    await updatedContent.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return updatedContent
  }

  /**
   * Delete content
   */
  async deleteContent(id: string): Promise<void> {
    await this.contentRepository.deleteByIdOrThrow(id)
  }

  /**
   * Publish content
   */
  async publishContent(id: string, userId?: string, scheduledAt?: Date): Promise<any> {
    const content = await this.contentRepository.publish(id, userId, scheduledAt)

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Unpublish content
   */
  async unpublishContent(id: string): Promise<any> {
    const content = await this.contentRepository.unpublish(id)

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Archive content
   */
  async archiveContent(id: string): Promise<any> {
    const content = await this.contentRepository.archive(id)

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Get content version
   */
  async getContentVersion(contentId: string, versionId: string): Promise<any> {
    const content = await this.contentRepository.findByIdOrThrow(contentId)

    // Find the version
    const version = content.versions.find((v) => v._id.toString() === versionId)
    if (!version) {
      throw ApiError.notFound(`Version not found with ID: ${versionId}`)
    }

    // Populate creator if available
    if (version.createdBy) {
      await version.populate({ path: "createdBy", select: "-password" })
    }

    return version
  }

  /**
   * Restore content version
   */
  async restoreVersion(contentId: string, versionId: string, userId?: string): Promise<any> {
    // Restore the version
    const content = await this.contentRepository.restoreVersion(contentId, versionId)

    // Update the updatedBy field
    if (userId) {
      content.updatedBy = userId
      await content.save()
    }

    // Populate references
    await content.populate([
      { path: "contentType" },
      { path: "createdBy", select: "-password" },
      { path: "updatedBy", select: "-password" },
      { path: "publishedBy", select: "-password" },
    ])

    return content
  }

  /**
   * Validate data against content type
   */
  private async validateData(data: any, contentType: any, existingData: any = {}): Promise<any> {
    const validatedData = { ...existingData, ...data }
    const errors: any = {}

    // Validate each field
    for (const field of contentType.fields) {
      const fieldName = field.name
      const fieldValue = data[fieldName]

      // Skip validation for fields not in the input data (unless required)
      if (fieldValue === undefined && !field.validation?.required) {
        continue
      }

      // Check required fields
      if (field.validation?.required && (fieldValue === undefined || fieldValue === null || fieldValue === "")) {
        errors[fieldName] = `Field '${field.displayName}' is required`
        continue
      }

      // Skip further validation if field is not provided
      if (fieldValue === undefined) {
        continue
      }

      // Validate field based on type
      try {
        validatedData[fieldName] = await this.validateField(fieldValue, field)
      } catch (error: any) {
        errors[fieldName] = error.message
      }
    }

    // If there are validation errors, throw an error
    if (Object.keys(errors).length > 0) {
      throw ApiError.validationError("Content validation failed", errors)
    }

    return validatedData
  }

  /**
   * Validate a field value based on its type and validation rules
   */
  private async validateField(value: any, field: any): Promise<any> {
    const { type, validation = {} } = field

    // Handle null values
    if (value === null) {
      if (validation.required) {
        throw new Error(`Field '${field.displayName}' is required`)
      }
      return null
    }

    // Validate based on field type
    switch (type) {
      case FieldType.STRING:
      case FieldType.TEXT:
      case FieldType.RICH_TEXT:
        return this.validateStringField(value, field)

      case FieldType.NUMBER:
        return this.validateNumberField(value, field)

      case FieldType.BOOLEAN:
        return this.validateBooleanField(value)

      case FieldType.DATE:
      case FieldType.DATETIME:
        return this.validateDateField(value, field)

      case FieldType.EMAIL:
        return this.validateEmailField(value, field)

      case FieldType.URL:
        return this.validateUrlField(value, field)

      case FieldType.REFERENCE:
        return this.validateReferenceField(value, field)

      case FieldType.JSON:
        return this.validateJsonField(value)

      case FieldType.ARRAY:
        return this.validateArrayField(value, field)

      default:
        // For other types (like IMAGE, FILE), just return the value
        return value
    }
  }

  /**
   * Validate string fields
   */
  private validateStringField(value: any, field: any): string {
    if (typeof value !== "string") {
      throw new Error(`Field '${field.displayName}' must be a string`)
    }

    const { validation = {} } = field

    // Check min length
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      throw new Error(`Field '${field.displayName}' must be at least ${validation.minLength} characters long`)
    }

    // Check max length
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      throw new Error(`Field '${field.displayName}' must be at most ${validation.maxLength} characters long`)
    }

    // Check pattern
    if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
      throw new Error(`Field '${field.displayName}' does not match the required pattern`)
    }

    // Check enum values
    if (validation.enum && !validation.enum.includes(value)) {
      throw new Error(`Field '${field.displayName}' must be one of: ${validation.enum.join(", ")}`)
    }

    return value
  }

  /**
   * Validate number fields
   */
  private validateNumberField(value: any, field: any): number {
    // Convert string to number if possible
    const numValue = typeof value === "string" ? Number(value) : value

    if (typeof numValue !== "number" || isNaN(numValue)) {
      throw new Error(`Field '${field.displayName}' must be a number`)
    }

    const { validation = {} } = field

    // Check min value
    if (validation.min !== undefined && numValue < validation.min) {
      throw new Error(`Field '${field.displayName}' must be at least ${validation.min}`)
    }

    // Check max value
    if (validation.max !== undefined && numValue > validation.max) {
      throw new Error(`Field '${field.displayName}' must be at most ${validation.max}`)
    }

    return numValue
  }

  /**
   * Validate boolean fields
   */
  private validateBooleanField(value: any): boolean {
    // Convert string to boolean if possible
    if (value === "true") return true
    if (value === "false") return false

    if (typeof value !== "boolean") {
      throw new Error("Field must be a boolean")
    }

    return value
  }

  /**
   * Validate date fields
   */
  private validateDateField(value: any, field: any): Date {
    let dateValue: Date

    // Convert string to date if necessary
    if (typeof value === "string") {
      dateValue = new Date(value)
    } else if (value instanceof Date) {
      dateValue = value
    } else {
      throw new Error(`Field '${field.displayName}' must be a valid date`)
    }

    // Check if date is valid
    if (isNaN(dateValue.getTime())) {
      throw new Error(`Field '${field.displayName}' must be a valid date`)
    }

    return dateValue
  }

  /**
   * Validate email fields
   */
  private validateEmailField(value: any, field: any): string {
    if (typeof value !== "string") {
      throw new Error(`Field '${field.displayName}' must be a string`)
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      throw new Error(`Field '${field.displayName}' must be a valid email address`)
    }

    return value
  }

  /**
   * Validate URL fields
   */
  private validateUrlField(value: any, field: any): string {
    if (typeof value !== "string") {
      throw new Error(`Field '${field.displayName}' must be a string`)
    }

    // Simple URL validation
    try {
      new URL(value)
    } catch (error) {
      throw new Error(`Field '${field.displayName}' must be a valid URL`)
    }

    return value
  }

  /**
   * Validate reference fields
   */
  private async validateReferenceField(value: any, field: any): Promise<string> {
    // Reference fields should be MongoDB ObjectIDs
    if (typeof value !== "string" || !/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new Error(`Field '${field.displayName}' must be a valid reference ID`)
    }

    // In a real implementation, you might want to check if the referenced document exists
    // This would depend on the field settings specifying which collection to reference

    return value
  }

  /**
   * Validate JSON fields
   */
  private validateJsonField(value: any): any {
    // For JSON fields, we accept any valid JSON object or array
    if (typeof value !== "object") {
      throw new Error("Field must be a valid JSON object or array")
    }

    return value
  }

  /**
   * Validate array fields
   */
  private validateArrayField(value: any, field: any): any[] {
    if (!Array.isArray(value)) {
      throw new Error(`Field '${field.displayName}' must be an array`)
    }

    const { validation = {} } = field

    // Check min length
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      throw new Error(`Field '${field.displayName}' must have at least ${validation.minLength} items`)
    }

    // Check max length
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      throw new Error(`Field '${field.displayName}' must have at most ${validation.maxLength} items`)
    }

    // In a real implementation, you might want to validate each item in the array
    // based on the field settings

    return value
  }
}
