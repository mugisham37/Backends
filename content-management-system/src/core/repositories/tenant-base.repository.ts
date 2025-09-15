import { eq, and } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { BaseRepository } from "./base.repository.js";
import type {
  ITenantRepository,
  TenantEntity,
  FilterOptions,
  PaginatedResult,
} from "../types/database.types.js";
import type { Result } from "../types/result.types.js";
import { DatabaseError } from "../errors/database.error.js";

/**
 * Base repository for tenant-scoped entities
 * Extends BaseRepository with tenant-aware operations
 */
export abstract class TenantBaseRepository<T extends TenantEntity, K = string>
  extends BaseRepository<T, K>
  implements ITenantRepository<T, K>
{
  constructor(protected readonly table: PgTable) {
    super(table);
  }

  /**
   * Find records by tenant ID
   */
  async findByTenant(
    tenantId: string,
    options?: FilterOptions<T>
  ): Promise<Result<T[], Error>> {
    try {
      const tenantFilter = {
        ...options,
        where: {
          ...options?.where,
          tenantId,
        },
      };

      return await this.findMany(tenantFilter);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find records by tenant", error),
      };
    }
  }

  /**
   * Find records by tenant ID with pagination
   */
  async findByTenantPaginated(
    tenantId: string,
    options?: FilterOptions<T>
  ): Promise<Result<PaginatedResult<T>, Error>> {
    try {
      const tenantFilter = {
        ...options,
        where: {
          ...options?.where,
          tenantId,
        },
      };

      return await this.findManyPaginated(tenantFilter);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find paginated records by tenant",
          error
        ),
      };
    }
  }

  /**
   * Count records by tenant ID
   */
  async countByTenant(
    tenantId: string,
    filter?: Partial<T>
  ): Promise<Result<number, Error>> {
    try {
      const tenantFilter = {
        ...filter,
        tenantId,
      };

      return await this.count(tenantFilter);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to count records by tenant", error),
      };
    }
  }

  /**
   * Create record with tenant ID validation
   */
  async create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<T, Error>> {
    try {
      // Ensure tenantId is provided
      if (!("tenantId" in data) || !data.tenantId) {
        return {
          success: false,
          error: new DatabaseError(
            "Tenant ID is required for tenant-scoped entities"
          ),
        };
      }

      return await super.create(data);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create tenant-scoped record",
          error
        ),
      };
    }
  }

  /**
   * Find record by ID within tenant scope
   */
  async findByIdInTenant(
    id: K,
    tenantId: string
  ): Promise<Result<T | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(this.table)
        .where(
          and(eq(this.table.id, id as any), eq(this.table.tenantId, tenantId))
        )
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? (result[0] as T) : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find record by ID in tenant scope",
          error
        ),
      };
    }
  }

  /**
   * Update record by ID within tenant scope
   */
  async updateInTenant(
    id: K,
    tenantId: string,
    data: Partial<T>
  ): Promise<Result<T, Error>> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
      } as any;

      const [result] = await this.db
        .update(this.table)
        .set(updateData)
        .where(
          and(eq(this.table.id, id as any), eq(this.table.tenantId, tenantId))
        )
        .returning();

      if (!result) {
        return {
          success: false,
          error: new DatabaseError(
            "Record not found in tenant scope for update"
          ),
        };
      }

      return { success: true, data: result as T };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update record in tenant scope",
          error
        ),
      };
    }
  }

  /**
   * Delete record by ID within tenant scope
   */
  async deleteInTenant(id: K, tenantId: string): Promise<Result<void, Error>> {
    try {
      const result = await this.db
        .delete(this.table)
        .where(
          and(eq(this.table.id, id as any), eq(this.table.tenantId, tenantId))
        )
        .returning();

      if (result.length === 0) {
        return {
          success: false,
          error: new DatabaseError(
            "Record not found in tenant scope for deletion"
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to delete record in tenant scope",
          error
        ),
      };
    }
  }
}
