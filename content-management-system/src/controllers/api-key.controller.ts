import type { Request, Response, NextFunction } from "express"
import { ApiKeyService } from "../services/api-key.service"
import { ApiKeyScope } from "../db/models/api-key.model"
import { ApiError } from "../utils/errors"
import mongoose from "mongoose"

export class ApiKeyController {
  private apiKeyService: ApiKeyService

  constructor() {
    this.apiKeyService = new ApiKeyService()
  }

  /**
   * Create a new API key
   */
  public createApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, scopes, expiresAt, tenantId } = req.body
      const user = (req as any).user

      // Validate scopes
      const validScopes = scopes.every((scope: string) => Object.values(ApiKeyScope).includes(scope as ApiKeyScope))
      if (!validScopes) {
        throw new ApiError(400, "Invalid scopes provided")
      }

      // Create API key
      const { apiKey, key } = await this.apiKeyService.createApiKey(
        name,
        scopes,
        new mongoose.Types.ObjectId(user.id),
        tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
        expiresAt ? new Date(expiresAt) : undefined,
      )

      res.status(201).json({
        status: "success",
        data: {
          apiKey: {
            id: apiKey._id,
            name: apiKey.name,
            scopes: apiKey.scopes,
            expiresAt: apiKey.expiresAt,
            tenantId: apiKey.tenantId,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
          },
          key, // Include the plain text key in the response
        },
        message: "API key created successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all API keys
   */
  public getAllApiKeys = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.query
      const apiKeys = await this.apiKeyService.getAllApiKeys(
        tenantId ? new mongoose.Types.ObjectId(tenantId as string) : undefined,
      )

      res.status(200).json({
        status: "success",
        data: {
          apiKeys: apiKeys.map((apiKey) => ({
            id: apiKey._id,
            name: apiKey.name,
            scopes: apiKey.scopes,
            expiresAt: apiKey.expiresAt,
            lastUsedAt: apiKey.lastUsedAt,
            tenantId: apiKey.tenantId,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          })),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get API key by ID
   */
  public getApiKeyById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const apiKey = await this.apiKeyService.getApiKeyById(id)

      res.status(200).json({
        status: "success",
        data: {
          apiKey: {
            id: apiKey._id,
            name: apiKey.name,
            scopes: apiKey.scopes,
            expiresAt: apiKey.expiresAt,
            lastUsedAt: apiKey.lastUsedAt,
            tenantId: apiKey.tenantId,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update API key
   */
  public updateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { name, scopes, isActive, expiresAt } = req.body

      // Validate scopes if provided
      if (scopes) {
        const validScopes = scopes.every((scope: string) => Object.values(ApiKeyScope).includes(scope as ApiKeyScope))
        if (!validScopes) {
          throw new ApiError(400, "Invalid scopes provided")
        }
      }

      const apiKey = await this.apiKeyService.updateApiKey(id, {
        name,
        scopes,
        isActive,
        expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
      })

      res.status(200).json({
        status: "success",
        data: {
          apiKey: {
            id: apiKey._id,
            name: apiKey.name,
            scopes: apiKey.scopes,
            expiresAt: apiKey.expiresAt,
            tenantId: apiKey.tenantId,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          },
        },
        message: "API key updated successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete API key
   */
  public deleteApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      await this.apiKeyService.deleteApiKey(id)

      res.status(200).json({
        status: "success",
        message: "API key deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Regenerate API key
   */
  public regenerateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { apiKey, key } = await this.apiKeyService.regenerateApiKey(id)

      res.status(200).json({
        status: "success",
        data: {
          apiKey: {
            id: apiKey._id,
            name: apiKey.name,
            scopes: apiKey.scopes,
            expiresAt: apiKey.expiresAt,
            tenantId: apiKey.tenantId,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          },
          key, // Include the plain text key in the response
        },
        message: "API key regenerated successfully",
      })
    } catch (error) {
      next(error)
    }
  }
}
