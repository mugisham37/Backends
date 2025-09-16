import type { NextFunction, Request, Response } from "express";
import { ApiKeyScope } from "../db/models/api-key.model";
import { ApiKeyService } from "../services/api-key.service";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";

export class ApiKeyMiddleware {
  private apiKeyService: ApiKeyService;

  constructor() {
    this.apiKeyService = new ApiKeyService();
  }

  /**
   * Middleware to authenticate requests using API key
   */
  public authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      // Get API key from header
      const apiKey = req.headers["x-api-key"] as string;

      if (!apiKey) {
        return next();
      }

      try {
        // Validate API key
        const validApiKey = await this.apiKeyService.validateApiKey(apiKey);

        // Attach API key info to request
        (req as any).apiKey = {
          id: validApiKey._id,
          scopes: validApiKey.scopes,
          tenantId: validApiKey.tenantId,
        };

        // If API key has a tenant, attach it to the request
        if (validApiKey.tenantId) {
          (req as any).tenantId = validApiKey.tenantId;
        }

        next();
      } catch (_error) {
        // If API key is invalid, continue as unauthenticated
        return next();
      }
    } catch (error) {
      logger.error("API key middleware error:", error);
      next(error);
    }
  };

  /**
   * Middleware to require API key authentication
   */
  public requireApiKey = (req: Request, _res: Response, next: NextFunction) => {
    if (!(req as any).apiKey) {
      return next(new ApiError(401, "API key required"));
    }

    next();
  };

  /**
   * Middleware to require specific API key scopes
   */
  public requireScopes = (scopes: ApiKeyScope[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (!(req as any).apiKey) {
        return next(new ApiError(401, "API key required"));
      }

      const apiKeyScopes = (req as any).apiKey.scopes as ApiKeyScope[];

      // Check if API key has admin scope (which grants all permissions)
      if (apiKeyScopes.includes(ApiKeyScope.ADMIN)) {
        return next();
      }

      // Check if API key has all required scopes
      const hasRequiredScopes = scopes.every((scope) =>
        apiKeyScopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        return next(
          new ApiError(403, "API key does not have the required permissions")
        );
      }

      next();
    };
  };
}

// Create and export middleware instances
const apiKeyMiddleware = new ApiKeyMiddleware();
export const authenticateApiKey = apiKeyMiddleware.authenticate;
export const requireApiKey = apiKeyMiddleware.requireApiKey;
export const requireApiKeyScopes = apiKeyMiddleware.requireScopes;
