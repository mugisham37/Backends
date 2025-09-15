import mongoose, { type Document, type Model, type FilterQuery, type UpdateQuery, type QueryOptions } from "mongoose"
import { ApiError } from "../../utils/errors"

export class BaseRepository<T extends Document> {
  protected model: Model<T>

  constructor(model: Model<T>) {
    this.model = model
  }

  /**
   * Find a document by ID
   */
  async findById(id: string, projection?: any, options?: QueryOptions): Promise<T | null> {
    try {
      return await this.model.findById(id, projection, options)
    } catch (error) {
      if (error instanceof mongoose.Error.CastError) {
        throw ApiError.badRequest(`Invalid ID format: ${id}`)
      }
      throw error
    }
  }

  /**
   * Find a document by ID or throw an error if not found
   */
  async findByIdOrThrow(id: string, projection?: any, options?: QueryOptions): Promise<T> {
    const document = await this.findById(id, projection, options)
    if (!document) {
      throw ApiError.notFound(`${this.model.modelName} not found with ID: ${id}`)
    }
    return document
  }

  /**
   * Find a single document by filter
   */
  async findOne(filter: FilterQuery<T>, projection?: any, options?: QueryOptions): Promise<T | null> {
    return this.model.findOne(filter, projection, options)
  }

  /**
   * Find a single document by filter or throw an error if not found
   */
  async findOneOrThrow(filter: FilterQuery<T>, projection?: any, options?: QueryOptions): Promise<T> {
    const document = await this.findOne(filter, projection, options)
    if (!document) {
      throw ApiError.notFound(`${this.model.modelName} not found`)
    }
    return document
  }

  /**
   * Find multiple documents by filter
   */
  async find(filter: FilterQuery<T>, projection?: any, options?: QueryOptions): Promise<T[]> {
    return this.model.find(filter, projection, options)
  }

  /**
   * Count documents by filter
   */
  async count(filter: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter)
  }

  /**
   * Create a new document
   */
  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data)
  }

  /**
   * Update a document by ID
   */
  async updateById(id: string, update: UpdateQuery<T>, options?: QueryOptions): Promise<T | null> {
    try {
      return await this.model.findByIdAndUpdate(id, update, { new: true, ...options })
    } catch (error) {
      if (error instanceof mongoose.Error.CastError) {
        throw ApiError.badRequest(`Invalid ID format: ${id}`)
      }
      throw error
    }
  }

  /**
   * Update a document by ID or throw an error if not found
   */
  async updateByIdOrThrow(id: string, update: UpdateQuery<T>, options?: QueryOptions): Promise<T> {
    const document = await this.updateById(id, update, options)
    if (!document) {
      throw ApiError.notFound(`${this.model.modelName} not found with ID: ${id}`)
    }
    return document
  }

  /**
   * Update a single document by filter
   */
  async updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>, options?: QueryOptions): Promise<T | null> {
    const result = await this.model.findOneAndUpdate(filter, update, { new: true, ...options })
    return result
  }

  /**
   * Update a single document by filter or throw an error if not found
   */
  async updateOneOrThrow(filter: FilterQuery<T>, update: UpdateQuery<T>, options?: QueryOptions): Promise<T> {
    const document = await this.updateOne(filter, update, options)
    if (!document) {
      throw ApiError.notFound(`${this.model.modelName} not found`)
    }
    return document
  }

  /**
   * Delete a document by ID
   */
  async deleteById(id: string, options?: QueryOptions): Promise<T | null> {
    try {
      return await this.model.findByIdAndDelete(id, options)
    } catch (error) {
      if (error instanceof mongoose.Error.CastError) {
        throw ApiError.badRequest(`Invalid ID format: ${id}`)
      }
      throw error
    }
  }

  /**
   * Delete a document by ID or throw an error if not found
   */
  async deleteByIdOrThrow(id: string, options?: QueryOptions): Promise<T> {
    const document = await this.deleteById(id, options)
    if (!document) {
      throw ApiError.notFound(`${this.model.modelName} not found with ID: ${id}`)
    }
    return document
  }

  /**
   * Delete a single document by filter
   */
  async deleteOne(filter: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOneAndDelete(filter, options)
  }

  /**
   * Delete multiple documents by filter
   */
  async deleteMany(filter: FilterQuery<T>): Promise<number> {
    const result = await this.model.deleteMany(filter)
    return result.deletedCount || 0
  }

  /**
   * Paginate documents
   */
  async paginate(
    filter: FilterQuery<T>,
    options: {
      page?: number
      limit?: number
      sort?: any
      projection?: any
      populate?: any
    } = {},
  ): Promise<{
    docs: T[]
    totalDocs: number
    page: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }> {
    const { page = 1, limit = 10, sort, projection, populate } = options
    const skip = (page - 1) * limit

    const [docs, totalDocs] = await Promise.all([
      this.model
        .find(filter, projection)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate(populate || []),
      this.model.countDocuments(filter),
    ])

    const totalPages = Math.ceil(totalDocs / limit)

    return {
      docs,
      totalDocs,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }
  }

  /**
   * Get cursor-based pagination
   */
  async cursorPagination(
    filter: FilterQuery<T>,
    options: {
      first?: number
      after?: string
      last?: number
      before?: string
      sort?: any
      projection?: any
      populate?: any
    } = {},
  ): Promise<{
    edges: Array<{ cursor: string; node: T }>
    pageInfo: {
      hasNextPage: boolean
      hasPreviousPage: boolean
      startCursor?: string
      endCursor?: string
    }
    totalCount: number
  }> {
    const { first, after, last, before, sort = { _id: 1 }, projection, populate } = options

    // Validate pagination arguments
    if (first !== undefined && last !== undefined) {
      throw ApiError.badRequest("Cannot specify both first and last")
    }

    if (first !== undefined && first < 0) {
      throw ApiError.badRequest("first must be a positive integer")
    }

    if (last !== undefined && last < 0) {
      throw ApiError.badRequest("last must be a positive integer")
    }

    // Determine the limit
    const limit = first || last || 10

    // Build the query
    let query = this.model.find(filter, projection)

    // Apply cursor-based pagination
    if (after) {
      const afterId = Buffer.from(after, "base64").toString("utf8")
      query = query.where({ _id: { $gt: afterId } })
    }

    if (before) {
      const beforeId = Buffer.from(before, "base64").toString("utf8")
      query = query.where({ _id: { $lt: beforeId } })
    }

    // Apply sort
    query = query.sort(sort)

    // Apply limit
    query = query.limit(limit + 1) // Get one extra to check if there are more pages

    // Apply populate
    if (populate) {
      query = query.populate(populate)
    }

    // Execute the query
    let docs = await query.exec()

    // Check if there are more pages
    const hasMore = docs.length > limit
    if (hasMore) {
      docs = docs.slice(0, limit)
    }

    // If we're paginating from the end, reverse the results
    if (last) {
      docs = docs.reverse()
    }

    // Create edges
    const edges = docs.map((doc) => ({
      cursor: Buffer.from(doc._id.toString()).toString("base64"),
      node: doc,
    }))

    // Get total count
    const totalCount = await this.model.countDocuments(filter)

    // Build page info
    const pageInfo = {
      hasNextPage: last ? edges.length > 0 && before !== undefined : hasMore,
      hasPreviousPage: first ? edges.length > 0 && after !== undefined : hasMore,
      startCursor: edges.length > 0 ? edges[0].cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
    }

    return {
      edges,
      pageInfo,
      totalCount,
    }
  }
}
