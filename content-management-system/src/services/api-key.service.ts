import crypto from "crypto"
import { ApiKeyModel, type ApiKeyScope, type IApiKey } from "../db/models/api-key.model"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"
import type { Types } from "mongoose"

export class ApiKeyService {
  /**
   * Generate a new API key
   */
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString("hex")
  }

  /**
   * Create a new API key
   */
  public async createApiKey(
    name: string,
    scopes: ApiKeyScope[],
    createdBy: Types.ObjectId,
    tenantId?: Types.ObjectId,
    expiresAt?: Date,
  ): Promise<{ apiKey: IApiKey; key: string }> {
    try {
      // Check if API key with the same name already exists for this tenant
      if (tenantId) {
        const existingKey = await ApiKeyModel.findOne({ name, tenantId })
        if (existingKey) {
          throw new ApiError(409, `API key with name '${name}' already exists for this tenant`)
        }
      } else {
        const existingKey = await ApiKeyModel.findOne({ name, tenantId: { $exists: false } })
        if (existingKey) {
          throw new ApiError(409, `API key with name '${name}' already exists`)
        }
      }

      // Generate API key
      const key = this.generateApiKey()

      // Create API key in database
      const apiKey = new ApiKeyModel({
        name,
        key,
        scopes,
        createdBy,
        ...(tenantId && { tenantId }),
        ...(expiresAt && { expiresAt }),
      })

      await apiKey.save()

      // Return API key with the plain text key
      // The key will not be retrievable after this point
      return { apiKey, key }
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to create API key:", error)
      throw new ApiError(500, "Failed to create API key")
    }
  }

  /**
   * Get all API keys
   */
  public async getAllApiKeys(tenantId?: Types.ObjectId): Promise<IApiKey[]> {
    try {
      const query = tenantId ? { tenantId } : {}
      return await ApiKeyModel.find(query).sort({ createdAt: -1 })
    } catch (error) {
      logger.error("Failed to get API keys:", error)
      throw new ApiError(500, "Failed to get API keys")
    }
  }

  /**
   * Get API key by ID
   */
  public async getApiKeyById(id: string): Promise<IApiKey> {
    try {
      const apiKey = await ApiKeyModel.findById(id)
      if (!apiKey) {
        throw new ApiError(404, "API key not found")
      }
      return apiKey
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to get API key:", error)
      throw new ApiError(500, "Failed to get API key")
    }
  }

  /**
   * Update API key
   */
  public async updateApiKey(
    id: string,
    updates: { name?: string; scopes?: ApiKeyScope[]; isActive?: boolean; expiresAt?: Date | null },
  ): Promise<IApiKey> {
    try {
      const apiKey = await this.getApiKeyById(id)

      // Update fields
      if (updates.name !== undefined) apiKey.name = updates.name
      if (updates.scopes !== undefined) apiKey.scopes = updates.scopes
      if (updates.isActive !== undefined) apiKey.isActive = updates.isActive
      if (updates.expiresAt !== undefined) {
        apiKey.expiresAt = updates.expiresAt === null ? undefined : updates.expiresAt
      }

      await apiKey.save()
      return apiKey
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to update API key:", error)
      throw new ApiError(500, "Failed to update API key")
    }
  }

  /**
   * Delete API key
   */
  public async deleteApiKey(id: string): Promise<void> {
    try {
      const result = await ApiKeyModel.findByIdAndDelete(id)
      if (!result) {
        throw new ApiError(404, "API key not found")
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to delete API key:", error)
      throw new ApiError(500, "Failed to delete API key")
    }
  }

  /**
   * Validate API key
   */
  public async validateApiKey(key: string, requiredScopes?: ApiKeyScope[]): Promise<IApiKey> {
    try {
      const apiKey = await ApiKeyModel.findOne({ key })

      if (!apiKey) {
        throw new ApiError(401, "Invalid API key")
      }

      if (!apiKey.isActive) {
        throw new ApiError(401, "API key is inactive")
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw new ApiError(401, "API key has expired")
      }

      // Check if the API key has the required scopes
      if (requiredScopes && requiredScopes.length > 0) {
        const hasRequiredScopes = requiredScopes.every((scope) => apiKey.scopes.includes(scope))
        if (!hasRequiredScopes) {
          throw new ApiError(403, "API key does not have the required permissions")
        }
      }

      // Update last used timestamp
      apiKey.lastUsedAt = new Date()
      await apiKey.save()

      return apiKey
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to validate API key:", error)
      throw new ApiError(500, "Failed to validate API key")
    }
  }

  /**
   * Regenerate API key
   */
  public async regenerateApiKey(id: string): Promise<{ apiKey: IApiKey; key: string }> {
    try {
      const apiKey = await this.getApiKeyById(id)

      // Generate new key
      const key = this.generateApiKey()
      apiKey.key = key

      await apiKey.save()

      return { apiKey, key }
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to regenerate API key:", error)
      throw new ApiError(500, "Failed to regenerate API key")
    }
  }
}
