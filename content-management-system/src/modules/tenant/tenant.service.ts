import { inject, injectable } from "tsyringe";
import type { Tenant } from "../../core/database/schema/tenant.schema";
import { CacheInvalidate } from "../../core/decorators/cache.decorator";
import { Validate } from "../../core/decorators/validate.decorator";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors";
import { TenantRepository } from "../../core/repositories/tenant.repository";
import { UserRepository } from "../../core/repositories/user.repository";
import type { Result } from "../../core/types/result.types";
import { CACHE_KEYS, CACHE_TTL } from "../../shared/constants";
import { logger } from "../../shared/utils/logger";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import { createTenantSchema, updateTenantSchema } from "./tenant.schemas";

/**
 * Multi-tenancy service with tenant isolation and user management
 * Handles tenant CRUD operations and user-tenant relationships
 */
@injectable()
export class TenantService {
  constructor(
    @inject("TenantRepository") private _tenantRepository: TenantRepository,
    @inject("UserRepository") private _userRepository: UserRepository,
    @inject("CacheService") private _cacheService: CacheService,
    @inject("AuditService") private _auditService: AuditService
  ) {}

  /**
   * Create a new tenant
   */
  @Validate({ input: createTenantSchema })
  @CacheInvalidate()
  async createTenant(data: {
    name: string;
    slug?: string;
    description?: string;
    domain?: string;
    subdomain?: string;
    settings?: any;
    metadata?: any;
  }): Promise<Result<Tenant, Error>> {
    try {
      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        slug = this.generateSlug(data.name);
      }

      // Validate slug format
      if (!this.isValidSlug(slug)) {
        return {
          success: false,
          error: new ValidationError(
            "Slug must contain only lowercase letters, numbers, and hyphens",
            "slug",
            slug
          ),
        };
      }

      // Check if slug is already taken
      const existingTenant = await this._tenantRepository.findBySlug(slug);
      if (existingTenant.success && existingTenant.data) {
        return {
          success: false,
          error: new ConflictError("Tenant slug is already taken"),
        };
      }

      // Check domain uniqueness if provided
      if (data.domain) {
        const existingDomain = await this._tenantRepository.findByDomain(
          data.domain
        );
        if (existingDomain.success && existingDomain.data) {
          return {
            success: false,
            error: new ConflictError("Domain is already taken"),
          };
        }
      }

      // Check subdomain uniqueness if provided
      if (data.subdomain) {
        const existingSubdomain = await this._tenantRepository.findBySubdomain(
          data.subdomain
        );
        if (existingSubdomain.success && existingSubdomain.data) {
          return {
            success: false,
            error: new ConflictError("Subdomain is already taken"),
          };
        }
      }

      // Create tenant
      const tenantData = {
        name: data.name,
        slug,
        description: data.description ?? null,
        domain: data.domain ?? null,
        subdomain: data.subdomain ?? null,
        isActive: true,
        settings: data.settings || null,
        metadata: data.metadata || null,
      } as const;

      const result = await this._tenantRepository.create(tenantData);
      if (!result.success) {
        return result;
      }

      // Log tenant creation
      await this._auditService.logTenantEvent({
        tenantId: result.data.id,
        event: "tenant_created",
        details: {
          name: data.name,
          slug,
          timestamp: new Date(),
        },
      });

      logger.info(`Tenant created: ${data.name} (${result.data.id})`);

      return result;
    } catch (error) {
      logger.error("Error creating tenant:", error);
      return {
        success: false,
        error: new Error("Failed to create tenant"),
      };
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Result<Tenant, NotFoundError>> {
    try {
      // Check cache first
      const cacheKey = `${CACHE_KEYS.TENANT_PREFIX}${id}`;
      const cachedTenant = await this._cacheService.get<Tenant>(cacheKey);
      if (cachedTenant) {
        return { success: true, data: cachedTenant };
      }

      const result = await this._tenantRepository.findById(id);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: new NotFoundError("Tenant not found"),
        };
      }

      // Cache tenant for configured time
      await this._cacheService.set(cacheKey, result.data, CACHE_TTL.MEDIUM);

      return result as Result<Tenant, NotFoundError>;
    } catch (error) {
      logger.error(`Error getting tenant by ID ${id}:`, error);
      return {
        success: false,
        error: new NotFoundError("Tenant not found"),
      };
    }
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Result<Tenant, NotFoundError>> {
    try {
      // Check cache first
      const cacheKey = `tenant:slug:${slug}`;
      const cachedTenant = await this._cacheService.get<Tenant>(cacheKey);
      if (cachedTenant) {
        return { success: true, data: cachedTenant };
      }

      const result = await this._tenantRepository.findBySlug(slug);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: new NotFoundError("Tenant not found"),
        };
      }

      // Cache tenant for 10 minutes
      await this._cacheService.set(cacheKey, result.data, 10 * 60);

      return result as Result<Tenant, NotFoundError>;
    } catch (error) {
      logger.error(`Error getting tenant by slug ${slug}:`, error);
      return {
        success: false,
        error: new NotFoundError("Tenant not found"),
      };
    }
  }

  /**
   * Update tenant
   */
  @Validate({ input: updateTenantSchema })
  async updateTenant(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      domain: string;
      subdomain: string;
      settings: any;
      metadata: any;
    }>
  ): Promise<Result<Tenant, Error>> {
    try {
      // Check if tenant exists
      const existingTenant = await this.getTenantById(id);
      if (!existingTenant.success) {
        return existingTenant;
      }

      // Check domain uniqueness if being updated
      if (data.domain && data.domain !== existingTenant.data.domain) {
        const existingDomain = await this._tenantRepository.findByDomain(
          data.domain
        );
        if (existingDomain.success && existingDomain.data) {
          return {
            success: false,
            error: new ConflictError("Domain is already taken"),
          };
        }
      }

      // Check subdomain uniqueness if being updated
      if (data.subdomain && data.subdomain !== existingTenant.data.subdomain) {
        const existingSubdomain = await this._tenantRepository.findBySubdomain(
          data.subdomain
        );
        if (existingSubdomain.success && existingSubdomain.data) {
          return {
            success: false,
            error: new ConflictError("Subdomain is already taken"),
          };
        }
      }

      // Update tenant
      const result = await this._tenantRepository.update(id, data);
      if (!result.success) {
        return result;
      }

      // Clear cache
      await this._cacheService.delete(`tenant:${id}`);
      await this._cacheService.delete(`tenant:slug:${existingTenant.data.slug}`);

      // Log tenant update
      await this._auditService.logTenantEvent({
        tenantId: id,
        event: "tenant_updated",
        details: {
          changes: data,
          timestamp: new Date(),
        },
      });

      logger.info(`Tenant updated: ${result.data.name} (${id})`);

      return result;
    } catch (error) {
      logger.error(`Error updating tenant ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to update tenant"),
      };
    }
  }

  /**
   * Delete tenant (soft delete by deactivating)
   */
  async deleteTenant(id: string): Promise<Result<void, Error>> {
    try {
      // Check if tenant exists
      const existingTenant = await this.getTenantById(id);
      if (!existingTenant.success) {
        return {
          success: false,
          error: existingTenant.error,
        };
      }

      // Check if tenant has active users
      const userCount = await this._tenantRepository.getUserCount(id);
      if (userCount.success && userCount.data > 0) {
        return {
          success: false,
          error: new BusinessRuleError(
            "Cannot delete tenant with active users"
          ),
        };
      }

      // Deactivate tenant instead of hard delete
      const result = await this._tenantRepository.update(id, {
        isActive: false,
      });
      if (!result.success) {
        return {
          success: false,
          error: new Error("Failed to deactivate tenant"),
        };
      }

      // Clear cache
      await this._cacheService.delete(`tenant:${id}`);
      await this._cacheService.delete(`tenant:slug:${existingTenant.data.slug}`);

      // Log tenant deletion
      await this._auditService.logTenantEvent({
        tenantId: id,
        event: "tenant_deleted",
        details: {
          name: existingTenant.data.name,
          timestamp: new Date(),
        },
      });

      logger.info(`Tenant deactivated: ${existingTenant.data.name} (${id})`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Error deleting tenant ${id}:`, error);
      return {
        success: false,
        error: new Error("Failed to delete tenant"),
      };
    }
  }

  /**
   * List tenants with pagination and filtering
   */
  async listTenants(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {}
  ): Promise<
    Result<
      {
        tenants: Tenant[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      },
      Error
    >
  > {
    try {
      const { page = 1, limit = 20, search, isActive } = options;

      // Build filter
      const filter: any = {};
      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      // Build search conditions
      let searchConditions: any = {};
      if (search) {
        searchConditions = {
          _or: [
            { name: { _ilike: `%${search}%` } },
            { slug: { _ilike: `%${search}%` } },
            { description: { _ilike: `%${search}%` } },
          ],
        };
      }

      const finalFilter = search ? { ...filter, ...searchConditions } : filter;

      const result = await this._tenantRepository.findManyPaginated({
        where: finalFilter,
        pagination: { page, limit },
        orderBy: [{ field: "createdAt", direction: "desc" }],
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          tenants: result.data.data,
          pagination: result.data.pagination,
        },
      };
    } catch (error) {
      logger.error("Error listing tenants:", error);
      return {
        success: false,
        error: new Error("Failed to list tenants"),
      };
    }
  }

  /**
   * Get tenants for user
   */
  async getUserTenants(userId: string): Promise<Result<Tenant[], Error>> {
    try {
      // Check cache first
      const cacheKey = `user:${userId}:tenants`;
      const cachedTenants = await this._cacheService.get<Tenant[]>(cacheKey);
      if (cachedTenants) {
        return { success: true, data: cachedTenants };
      }

      const result = await this._tenantRepository.findTenantsForUser(userId);
      if (!result.success) {
        return result;
      }

      // Cache for 5 minutes
      await this._cacheService.set(cacheKey, result.data, 5 * 60);

      return result;
    } catch (error) {
      logger.error(`Error getting tenants for user ${userId}:`, error);
      return {
        success: false,
        error: new Error("Failed to get user tenants"),
      };
    }
  }

  /**
   * Check if user belongs to tenant
   */
  async isUserMemberOfTenant(
    tenantId: string,
    userId: string
  ): Promise<Result<boolean, Error>> {
    try {
      // Check cache first
      const cacheKey = `user:${userId}:tenant:${tenantId}:member`;
      const cachedResult = await this._cacheService.get<boolean>(cacheKey);
      if (cachedResult !== null) {
        return { success: true, data: cachedResult };
      }

      // Check if user exists in tenant
      const userResult = await this._userRepository.findById(userId);
      if (!userResult.success || !userResult.data) {
        return { success: true, data: false };
      }

      const isMember = userResult.data.tenantId === tenantId;

      // Cache result for 5 minutes
      await this._cacheService.set(cacheKey, isMember, 5 * 60);

      return { success: true, data: isMember };
    } catch (error) {
      logger.error(
        `Error checking if user ${userId} is member of tenant ${tenantId}:`,
        error
      );
      return {
        success: false,
        error: new Error("Failed to check tenant membership"),
      };
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string): Promise<
    Result<
      {
        userCount: number;
        contentCount: number;
        mediaCount: number;
        storageUsed: number;
      },
      Error
    >
  > {
    try {
      // Check cache first
      const cacheKey = `tenant:${tenantId}:stats`;
      const cachedStats = await this._cacheService.get<{
        userCount: number;
        contentCount: number;
        mediaCount: number;
        storageUsed: number;
      }>(cacheKey);
      if (cachedStats) {
        return { success: true, data: cachedStats };
      }

      // Get statistics
      const [userCount, contentCount, mediaCount] = await Promise.all([
        this._tenantRepository.getUserCount(tenantId),
        this._tenantRepository.getContentCount(tenantId),
        this._tenantRepository.getMediaCount(tenantId),
      ]);

      if (!userCount.success || !contentCount.success || !mediaCount.success) {
        return {
          success: false,
          error: new Error("Failed to get tenant statistics"),
        };
      }

      const stats = {
        userCount: userCount.data,
        contentCount: contentCount.data,
        mediaCount: mediaCount.data,
        storageUsed: 0,
      };

      // Cache for 10 minutes
      await this._cacheService.set(cacheKey, stats, 10 * 60);

      return { success: true, data: stats };
    } catch (error) {
      logger.error(`Error getting tenant stats for ${tenantId}:`, error);
      return {
        success: false,
        error: new Error("Failed to get tenant statistics"),
      };
    }
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(
    tenantId: string,
    settings: any
  ): Promise<Result<Tenant, Error>> {
    try {
      const existingTenant = await this.getTenantById(tenantId);
      if (!existingTenant.success) {
        return existingTenant;
      }

      // Merge settings
      const updatedSettings = {
        ...existingTenant.data.settings,
        ...settings,
      };

      const result = await this.updateTenant(tenantId, {
        settings: updatedSettings,
      });
      if (!result.success) {
        return result;
      }

      // Log settings update
      await this._auditService.logTenantEvent({
        tenantId,
        event: "tenant_settings_updated",
        details: {
          changes: settings,
          timestamp: new Date(),
        },
      });

      return result;
    } catch (error) {
      logger.error(`Error updating tenant settings for ${tenantId}:`, error);
      return {
        success: false,
        error: new Error("Failed to update tenant settings"),
      };
    }
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  /**
   * Validate slug format
   */
  private isValidSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && slug.length <= 50;
  }
}
