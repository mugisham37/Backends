import { eq, ilike, and, count } from "drizzle-orm";
import { injectable } from "tsyringe";
import { BaseRepository } from "./base.repository.js";
import { tenants, users } from "../database/schema/index.js";
import type { Tenant, NewTenant, User } from "../database/schema/index.js";
import type { Result } from "../types/result.types.js";
import { DatabaseError } from "../errors/database.error.js";
import { NotFoundError } from "../errors/not-found.error.js";

/**
 * Tenant repository with multi-tenancy management methods
 */
@injectable()
export class TenantRepository extends BaseRepository<Tenant> {
  constructor() {
    super(tenants);
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Result<Tenant | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, slug.toLowerCase()))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find tenant by slug", error),
      };
    }
  }

  /**
   * Find tenant by domain
   */
  async findByDomain(domain: string): Promise<Result<Tenant | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(tenants)
        .where(eq(tenants.domain, domain.toLowerCase()))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find tenant by domain", error),
      };
    }
  }

  /**
   * Search tenants by name
   */
  async searchByName(
    query: string,
    limit = 20
  ): Promise<Result<Tenant[], Error>> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;

      const result = await this.db
        .select()
        .from(tenants)
        .where(
          and(eq(tenants.isActive, true), ilike(tenants.name, searchPattern))
        )
        .limit(limit);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to search tenants", error),
      };
    }
  }

  /**
   * Get active tenants only
   */
  async findActiveTenants(): Promise<Result<Tenant[], Error>> {
    try {
      const result = await this.db
        .select()
        .from(tenants)
        .where(eq(tenants.isActive, true))
        .orderBy(tenants.name);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find active tenants", error),
      };
    }
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(
    slug: string,
    excludeId?: string
  ): Promise<Result<boolean, Error>> {
    try {
      let query = this.db
        .select({ count: count() })
        .from(tenants)
        .where(eq(tenants.slug, slug.toLowerCase()));

      if (excludeId) {
        query = query.where(
          and(eq(tenants.slug, slug.toLowerCase()), eq(tenants.id, excludeId))
        );
      }

      const [{ count: tenantCount }] = await query;

      return { success: true, data: tenantCount === 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to check slug availability", error),
      };
    }
  }

  /**
   * Check if domain is available
   */
  async isDomainAvailable(
    domain: string,
    excludeId?: string
  ): Promise<Result<boolean, Error>> {
    try {
      let query = this.db
        .select({ count: count() })
        .from(tenants)
        .where(eq(tenants.domain, domain.toLowerCase()));

      if (excludeId) {
        query = query.where(
          and(
            eq(tenants.domain, domain.toLowerCase()),
            eq(tenants.id, excludeId)
          )
        );
      }

      const [{ count: tenantCount }] = await query;

      return { success: true, data: tenantCount === 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to check domain availability", error),
      };
    }
  }

  /**
   * Activate tenant
   */
  async activateTenant(tenantId: string): Promise<Result<Tenant, Error>> {
    try {
      const [result] = await this.db
        .update(tenants)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Tenant not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to activate tenant", error),
      };
    }
  }

  /**
   * Deactivate tenant
   */
  async deactivateTenant(tenantId: string): Promise<Result<Tenant, Error>> {
    try {
      const [result] = await this.db
        .update(tenants)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Tenant not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to deactivate tenant", error),
      };
    }
  }

  /**
   * Update tenant settings
   */
  async updateSettings(
    tenantId: string,
    settings: Record<string, unknown>
  ): Promise<Result<Tenant, Error>> {
    try {
      const [result] = await this.db
        .update(tenants)
        .set({
          settings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("Tenant not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to update tenant settings", error),
      };
    }
  }

  /**
   * Get tenant with user count
   */
  async findWithUserCount(tenantId: string): Promise<
    Result<
      {
        tenant: Tenant;
        userCount: number;
      } | null,
      Error
    >
  > {
    try {
      const tenantResult = await this.findById(tenantId);
      if (!tenantResult.success || !tenantResult.data) {
        return { success: true, data: null };
      }

      const [{ count: userCount }] = await this.db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

      return {
        success: true,
        data: {
          tenant: tenantResult.data,
          userCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find tenant with user count",
          error
        ),
      };
    }
  }

  /**
   * Get tenant users
   */
  async getTenantUsers(
    tenantId: string,
    activeOnly = true
  ): Promise<Result<User[], Error>> {
    try {
      let query = this.db
        .select()
        .from(users)
        .where(eq(users.tenantId, tenantId));

      if (activeOnly) {
        query = query.where(
          and(eq(users.tenantId, tenantId), eq(users.isActive, true))
        );
      }

      const result = await query.orderBy(users.email);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get tenant users", error),
      };
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string): Promise<
    Result<
      {
        totalUsers: number;
        activeUsers: number;
        adminUsers: number;
      },
      Error
    >
  > {
    try {
      const [totalUsersResult] = await this.db
        .select({ count: count() })
        .from(users)
        .where(eq(users.tenantId, tenantId));

      const [activeUsersResult] = await this.db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

      const [adminUsersResult] = await this.db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.role, "admin"),
            eq(users.isActive, true)
          )
        );

      return {
        success: true,
        data: {
          totalUsers: totalUsersResult.count,
          activeUsers: activeUsersResult.count,
          adminUsers: adminUsersResult.count,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get tenant statistics", error),
      };
    }
  }

  /**
   * Find tenant by subdomain
   */
  async findBySubdomain(
    subdomain: string
  ): Promise<Result<Tenant | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain.toLowerCase()))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find tenant by subdomain", error),
      };
    }
  }

  /**
   * Find tenants for user
   */
  async findTenantsForUser(userId: string): Promise<Result<Tenant[], Error>> {
    try {
      const result = await this.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          description: tenants.description,
          domain: tenants.domain,
          subdomain: tenants.subdomain,
          isActive: tenants.isActive,
          settings: tenants.settings,
          metadata: tenants.metadata,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
        })
        .from(tenants)
        .innerJoin(users, eq(users.tenantId, tenants.id))
        .where(and(eq(users.id, userId), eq(tenants.isActive, true)));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find tenants for user", error),
      };
    }
  }

  /**
   * Get user count for tenant
   */
  async getUserCount(tenantId: string): Promise<Result<number, Error>> {
    try {
      const [result] = await this.db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

      return { success: true, data: result.count };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get user count", error),
      };
    }
  }

  /**
   * Get content count for tenant
   */
  async getContentCount(tenantId: string): Promise<Result<number, Error>> {
    try {
      // This would need to be implemented when content schema is available
      // For now, return 0
      return { success: true, data: 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get content count", error),
      };
    }
  }

  /**
   * Get media count for tenant
   */
  async getMediaCount(tenantId: string): Promise<Result<number, Error>> {
    try {
      // This would need to be implemented when media schema is available
      // For now, return 0
      return { success: true, data: 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to get media count", error),
      };
    }
  }
}
