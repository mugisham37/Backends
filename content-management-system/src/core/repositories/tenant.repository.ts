import { eq, ilike, or, and, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { tenants } from "../database/schema/tenant.schema.ts";
import { users } from "../database/schema/auth.schema.ts";
import { contents } from "../database/schema/content.schema.ts";
import { media } from "../database/schema/media.schema.ts";
import { DatabaseError } from "../errors/database.error.ts";
import type {
  FilterOptions,
  PaginatedResult,
} from "../types/database.types.ts";
import type { Result } from "../types/result.types.ts";
import { BaseRepository } from "./base.repository.ts";

/**
 * Tenant entity type
 */
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

/**
 * Tenant-specific filter options
 */
export interface TenantFilterOptions extends FilterOptions<Tenant> {
  isActive?: boolean;
  search?: string; // Search in name, slug, domain, subdomain
}

/**
 * Tenant repository implementation
 * Handles all database operations for tenants
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
      const [tenant] = await this.db
        .select()
        .from(this.table)
        .where(eq(tenants.slug, slug))
        .limit(1);

      return { success: true, data: (tenant as Tenant) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find tenant by slug",
          "findBySlug",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find tenant by domain
   */
  async findByDomain(domain: string): Promise<Result<Tenant | null, Error>> {
    try {
      const [tenant] = await this.db
        .select()
        .from(this.table)
        .where(eq(tenants.domain, domain))
        .limit(1);

      return { success: true, data: (tenant as Tenant) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find tenant by domain",
          "findByDomain",
          this.table._.name,
          error
        ),
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
      const [tenant] = await this.db
        .select()
        .from(this.table)
        .where(eq(tenants.subdomain, subdomain))
        .limit(1);

      return { success: true, data: (tenant as Tenant) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find tenant by subdomain",
          "findBySubdomain",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Search tenants with advanced filtering
   */
  async searchTenants(
    options: TenantFilterOptions = {}
  ): Promise<Result<PaginatedResult<Tenant>, Error>> {
    try {
      const conditions = [];

      // Add active status filter
      if (typeof options.isActive === "boolean") {
        conditions.push(eq(tenants.isActive, options.isActive));
      }

      // Add search filter
      if (options.search) {
        const searchTerm = `%${options.search}%`;
        conditions.push(
          or(
            ilike(tenants.name, searchTerm),
            ilike(tenants.slug, searchTerm),
            ilike(tenants.domain, searchTerm),
            ilike(tenants.subdomain, searchTerm),
            ilike(tenants.description, searchTerm)
          )
        );
      }

      // Build the complete filter options
      const filterOptions: FilterOptions<Tenant> = {
        ...options,
      };

      if (conditions.length > 0) {
        (filterOptions as any).where = and(...conditions);
      }

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to search tenants",
          "searchTenants",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find active tenants
   */
  async findActiveTenants(): Promise<Result<Tenant[], Error>> {
    try {
      const activeTenants = await this.db
        .select()
        .from(this.table)
        .where(eq(tenants.isActive, true));

      return { success: true, data: activeTenants as Tenant[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find active tenants",
          "findActiveTenants",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update tenant settings
   */
  async updateSettings(
    id: string,
    settings: Record<string, unknown>
  ): Promise<Result<Tenant, Error>> {
    try {
      const [updatedTenant] = await this.db
        .update(this.table)
        .set({
          settings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!updatedTenant) {
        return {
          success: false,
          error: new DatabaseError(
            "Tenant not found",
            "updateSettings",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedTenant as Tenant };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update tenant settings",
          "updateSettings",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update tenant metadata
   */
  async updateMetadata(
    id: string,
    metadata: Record<string, unknown>
  ): Promise<Result<Tenant, Error>> {
    try {
      const [updatedTenant] = await this.db
        .update(this.table)
        .set({
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!updatedTenant) {
        return {
          success: false,
          error: new DatabaseError(
            "Tenant not found",
            "updateMetadata",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedTenant as Tenant };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update tenant metadata",
          "updateMetadata",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Activate tenant
   */
  async activate(id: string): Promise<Result<Tenant, Error>> {
    try {
      const [updatedTenant] = await this.db
        .update(this.table)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!updatedTenant) {
        return {
          success: false,
          error: new DatabaseError(
            "Tenant not found",
            "activate",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedTenant as Tenant };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to activate tenant",
          "activate",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Deactivate tenant
   */
  async deactivate(id: string): Promise<Result<Tenant, Error>> {
    try {
      const [updatedTenant] = await this.db
        .update(this.table)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!updatedTenant) {
        return {
          success: false,
          error: new DatabaseError(
            "Tenant not found",
            "deactivate",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedTenant as Tenant };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to deactivate tenant",
          "deactivate",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Count total tenants
   */
  async countTenants(): Promise<Result<number, Error>> {
    try {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.table);

      return { success: true, data: result?.count || 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to count tenants",
          "countTenants",
          this.table._.name,
          error
        ),
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
      const conditions = [eq(tenants.slug, slug)];

      if (excludeId) {
        conditions.push(sql`${tenants.id} != ${excludeId}`);
      }

      const [existing] = await this.db
        .select({ id: tenants.id })
        .from(this.table)
        .where(and(...conditions))
        .limit(1);

      return { success: true, data: !existing };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check slug availability",
          "isSlugAvailable",
          this.table._.name,
          error
        ),
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
      const conditions = [eq(tenants.domain, domain)];

      if (excludeId) {
        conditions.push(sql`${tenants.id} != ${excludeId}`);
      }

      const [existing] = await this.db
        .select({ id: tenants.id })
        .from(this.table)
        .where(and(...conditions))
        .limit(1);

      return { success: true, data: !existing };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check domain availability",
          "isDomainAvailable",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Check if subdomain is available
   */
  async isSubdomainAvailable(
    subdomain: string,
    excludeId?: string
  ): Promise<Result<boolean, Error>> {
    try {
      const conditions = [eq(tenants.subdomain, subdomain)];

      if (excludeId) {
        conditions.push(sql`${tenants.id} != ${excludeId}`);
      }

      const [existing] = await this.db
        .select({ id: tenants.id })
        .from(this.table)
        .where(and(...conditions))
        .limit(1);

      return { success: true, data: !existing };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check subdomain availability",
          "isSubdomainAvailable",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get user count for a tenant
   */
  async getUserCount(tenantId: string): Promise<Result<number, Error>> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.tenantId, tenantId));

      return {
        success: true,
        data: result[0]?.count || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get user count",
          "getUserCount",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get content count for a tenant
   */
  async getContentCount(tenantId: string): Promise<Result<number, Error>> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(contents)
        .where(eq(contents.tenantId, tenantId));

      return {
        success: true,
        data: result[0]?.count || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get content count",
          "getContentCount",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Get media count for a tenant
   */
  async getMediaCount(tenantId: string): Promise<Result<number, Error>> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(media)
        .where(eq(media.tenantId, tenantId));

      return {
        success: true,
        data: result[0]?.count || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get media count",
          "getMediaCount",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find tenants for a user
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
        .where(eq(users.id, userId));

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find tenants for user",
          "findTenantsForUser",
          this.table._.name,
          error
        ),
      };
    }
  }
}
