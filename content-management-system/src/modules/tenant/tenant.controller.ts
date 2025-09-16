import type { NextFunction, Request, Response } from "express";
import {
  type TenantPlan,
  type TenantStatus,
  TenantUserRole,
} from "../db/models/tenant.model";
import { TenantService } from "./tenant.service";
import { ApiError } from "../utils/errors";

export class TenantController {
  private tenantService: TenantService;

  constructor() {
    this.tenantService = new TenantService();
  }

  /**
   * Create a new tenant
   */
  public createTenant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { name, slug, description, plan } = req.body;
      const userId = (req as any).user.id;

      const tenant = await this.tenantService.createTenant({
        name,
        slug,
        description,
        plan: plan as TenantPlan,
        ownerId: userId,
      });

      res.status(201).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get tenant by ID
   */
  public getTenantById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      const tenant = await this.tenantService.getTenantById(id);

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update tenant
   */
  public updateTenant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { name, description, settings, billingInfo } = req.body;

      // Check if user has permission to update tenant
      const userId = (req as any).user.id;
      const userRole = await this.tenantService.getUserRoleInTenant(id, userId);

      if (
        !userRole ||
        ![TenantUserRole.OWNER, TenantUserRole.ADMIN].includes(userRole)
      ) {
        throw ApiError.forbidden(
          "You do not have permission to update this tenant"
        );
      }

      // Only allow certain fields to be updated
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (settings) updateData.settings = settings;
      if (billingInfo) updateData.billingInfo = billingInfo;

      const tenant = await this.tenantService.updateTenant(id, updateData);

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete tenant
   */
  public deleteTenant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Check if user has permission to delete tenant
      const userId = (req as any).user.id;
      const userRole = await this.tenantService.getUserRoleInTenant(id, userId);

      if (!userRole || userRole !== TenantUserRole.OWNER) {
        throw ApiError.forbidden("Only the tenant owner can delete the tenant");
      }

      await this.tenantService.deleteTenant(id);

      res.status(200).json({
        status: "success",
        message: "Tenant deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List tenants
   */
  public listTenants = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { page, limit, status, search, plan } = req.query;

      const result = await this.tenantService.listTenants({
        page: page ? Number.parseInt(page as string, 10) : undefined,
        limit: limit ? Number.parseInt(limit as string, 10) : undefined,
        status: status as TenantStatus,
        search: search as string,
        plan: plan as TenantPlan,
      });

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user tenants
   */
  public getUserTenants = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = (req as any).user.id;

      const tenants = await this.tenantService.getUserTenants(userId);

      res.status(200).json({
        status: "success",
        data: {
          tenants,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add user to tenant
   */
  public addUserToTenant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { userId, role } = req.body;
      const currentUserId = (req as any).user.id;

      // Check if current user has permission to add users
      const userRole = await this.tenantService.getUserRoleInTenant(
        id,
        currentUserId
      );

      if (
        !userRole ||
        ![TenantUserRole.OWNER, TenantUserRole.ADMIN].includes(userRole)
      ) {
        throw ApiError.forbidden(
          "You do not have permission to add users to this tenant"
        );
      }

      const tenant = await this.tenantService.addUserToTenant(id, {
        userId,
        role: role as TenantUserRole,
        invitedBy: currentUserId,
      });

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user role in tenant
   */
  public updateUserRole = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id, userId } = req.params;
      const { role } = req.body;
      const currentUserId = (req as any).user.id;

      // Check if current user has permission to update user roles
      const userRole = await this.tenantService.getUserRoleInTenant(
        id,
        currentUserId
      );

      if (
        !userRole ||
        ![TenantUserRole.OWNER, TenantUserRole.ADMIN].includes(userRole)
      ) {
        throw ApiError.forbidden(
          "You do not have permission to update user roles in this tenant"
        );
      }

      // If current user is admin, they cannot update the role of the owner or other admins
      if (userRole === TenantUserRole.ADMIN) {
        const targetUserRole = await this.tenantService.getUserRoleInTenant(
          id,
          userId
        );
        if (
          targetUserRole === TenantUserRole.OWNER ||
          (targetUserRole === TenantUserRole.ADMIN &&
            role !== TenantUserRole.MEMBER)
        ) {
          throw ApiError.forbidden(
            "Admins cannot change the role of owners or other admins"
          );
        }
      }

      const tenant = await this.tenantService.updateUserRole(
        id,
        userId,
        role as TenantUserRole
      );

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove user from tenant
   */
  public removeUserFromTenant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id, userId } = req.params;
      const currentUserId = (req as any).user.id;

      // Check if current user has permission to remove users
      const userRole = await this.tenantService.getUserRoleInTenant(
        id,
        currentUserId
      );

      if (
        !userRole ||
        ![TenantUserRole.OWNER, TenantUserRole.ADMIN].includes(userRole)
      ) {
        throw ApiError.forbidden(
          "You do not have permission to remove users from this tenant"
        );
      }

      // If current user is admin, they cannot remove the owner or other admins
      if (userRole === TenantUserRole.ADMIN) {
        const targetUserRole = await this.tenantService.getUserRoleInTenant(
          id,
          userId
        );
        if (
          targetUserRole === TenantUserRole.OWNER ||
          targetUserRole === TenantUserRole.ADMIN
        ) {
          throw ApiError.forbidden(
            "Admins cannot remove owners or other admins"
          );
        }
      }

      const tenant = await this.tenantService.removeUserFromTenant(id, userId);

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update tenant plan
   */
  public updateTenantPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { plan } = req.body;

      // This endpoint would typically be restricted to system admins or called by a billing service
      // For now, we'll just check if the user is the tenant owner
      const userId = (req as any).user.id;
      const userRole = await this.tenantService.getUserRoleInTenant(id, userId);

      if (!userRole || userRole !== TenantUserRole.OWNER) {
        throw ApiError.forbidden(
          "Only the tenant owner can update the tenant plan"
        );
      }

      const tenant = await this.tenantService.updateTenantPlan(
        id,
        plan as TenantPlan
      );

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update tenant status
   */
  public updateTenantStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // This endpoint would typically be restricted to system admins
      // For now, we'll just check if the user is the tenant owner
      const userId = (req as any).user.id;
      const userRole = await this.tenantService.getUserRoleInTenant(id, userId);

      if (!userRole || userRole !== TenantUserRole.OWNER) {
        throw ApiError.forbidden(
          "Only the tenant owner can update the tenant status"
        );
      }

      const tenant = await this.tenantService.updateTenantStatus(
        id,
        status as TenantStatus
      );

      res.status(200).json({
        status: "success",
        data: {
          tenant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get tenant usage
   */
  public getTenantUsage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Check if user has permission to view tenant usage
      const userId = (req as any).user.id;
      const isMember = await this.tenantService.isUserMemberOfTenant(
        id,
        userId
      );

      if (!isMember) {
        throw ApiError.forbidden(
          "You do not have permission to view this tenant's usage"
        );
      }

      const tenant = await this.tenantService.getTenantById(id);

      res.status(200).json({
        status: "success",
        data: {
          usage: tenant.currentUsage,
          limits: tenant.usageLimits,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
