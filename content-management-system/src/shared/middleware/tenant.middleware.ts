import type { NextFunction, Request, Response } from "express";
import type { TenantUserRole } from "../db/models/tenant.model";
import { TenantService } from "../../modules/tenant/tenant.service";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";

const tenantService = new TenantService();

/**
 * Middleware to resolve tenant from request
 * This middleware will attach the tenant to the request object if a tenant ID is provided
 */
export const resolveTenant = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Check for tenant ID in headers, query, or params
    const tenantId =
      req.headers["x-tenant-id"] ||
      req.query.tenantId ||
      req.params.tenantId ||
      req.body.tenantId;

    if (!tenantId) {
      return next();
    }

    try {
      const tenant = await tenantService.getTenantById(tenantId as string);
      (req as any).tenant = tenant;
    } catch (_error) {
      // If tenant not found, continue without attaching tenant
      logger.warn(`Tenant not found: ${tenantId}`);
    }

    next();
  } catch (error) {
    logger.error("Error resolving tenant:", error);
    next(error);
  }
};

/**
 * Middleware to require tenant
 * This middleware will ensure a tenant is attached to the request
 */
export const requireTenant = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!(req as any).tenant) {
    return next(ApiError.badRequest("Tenant ID is required"));
  }

  next();
};

/**
 * Middleware to check if user is a member of the tenant
 */
export const checkTenantMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!(req as any).tenant) {
      return next(ApiError.badRequest("Tenant ID is required"));
    }

    if (!(req as any).user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    const tenantId = (req as any).tenant._id;
    const userId = (req as any).user._id;

    const isMember = await tenantService.isUserMemberOfTenant(tenantId, userId);

    if (!isMember) {
      return next(ApiError.forbidden("You are not a member of this tenant"));
    }

    next();
  } catch (error) {
    logger.error("Error checking tenant membership:", error);
    next(error);
  }
};

/**
 * Middleware to check if user has specific role in tenant
 */
export const checkTenantRole = (roles: TenantUserRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!(req as any).tenant) {
        return next(ApiError.badRequest("Tenant ID is required"));
      }

      if (!(req as any).user) {
        return next(ApiError.unauthorized("Authentication required"));
      }

      const tenantId = (req as any).tenant._id;
      const userId = (req as any).user._id;

      const userRole = await tenantService.getUserRoleInTenant(
        tenantId,
        userId
      );

      if (!userRole || !roles.includes(userRole)) {
        return next(
          ApiError.forbidden(
            `This action requires one of the following roles: ${roles.join(
              ", "
            )}`
          )
        );
      }
      // Attach role to request for convenience
      (req as any).tenantRole = userRole;

      next();
    } catch (error) {
      logger.error("Error checking tenant role:", error);
      next(error);
    }
  };
};

/**
 * Middleware to track API requests for tenant
 */
export const trackTenantApiRequest = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if ((req as any).tenant) {
      const tenantId = (req as any).tenant._id;

      // Increment API request count asynchronously
      // We don't await this to avoid blocking the request
      tenantService.incrementApiRequestCount(tenantId).catch((error) => {
        logger.error(
          `Error incrementing API request count for tenant ${tenantId}:`,
          error
        );
      });
    }

    next();
  } catch (error) {
    logger.error("Error tracking tenant API request:", error);
    next();
  }
};

/**
 * Middleware to check if tenant has reached usage limit
 */
export const checkTenantLimit = (limitType: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!(req as any).tenant) {
        return next(ApiError.badRequest("Tenant ID is required"));
      }

      const tenantId = (req as any).tenant._id;

      const { hasReachedLimit, currentUsage, limit } =
        await tenantService.checkTenantLimit(tenantId, limitType as any);

      if (hasReachedLimit) {
        return next(
          ApiError.forbidden(
            `Tenant has reached the ${limitType} limit (${currentUsage}/${limit})`
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Error checking tenant ${limitType} limit:`, error);
      next(error);
    }
  };
};
