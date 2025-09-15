import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { BaseRepository } from "./base.repository.js";
import type {
  ISoftDeleteRepository,
  SoftDeleteEntity,
  FilterOptions,
} from "../types/database.types.js";
import type { Result } from "../types/result.types.js";
import { DatabaseError } from "../errors/database.error.js";

/**
 * Base repository for entities with soft delete functionality
 * Extends BaseRepository with soft delete operations
 */
export abstract class SoftDeleteBaseRepository<
    T extends SoftDeleteEntity,
    K = string
  >
  extends BaseRepository<T, K>
  implements ISoftDeleteRepository<T, K>
{
  constructor(protected readonly table: PgTable) {
    super(table);
  }

  /**
   * Override findMany to exclude soft-deleted records by default
   */
  async findMany(options?: FilterOptions<T>): Promise<Result<T[], Error>> {
    const filterWithSoftDelete = {
      ...options,
      where: {
        ...options?.where,
        deletedAt: null,
      },
    };

    return await super.findMany(filterWithSoftDelete);
  }

  /**
   * Override findById to exclude soft-deleted records
   */
  async findById(id: K): Promise<Result<T | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(this.table)
        .where(and(eq(this.table.id, id as any), isNull(this.table.deletedAt)))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? (result[0] as T) : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find record by ID", error),
      };
    }
  }

  /**
   * Override findOne to exclude soft-deleted records
   */
  async findOne(filter: Partial<T>): Promise<Result<T | null, Error>> {
    const filterWithSoftDelete = {
      ...filter,
      deletedAt: null,
    };

    return await super.findOne(filterWithSoftDelete);
  }

  /**
   * Override count to exclude soft-deleted records
   */
  async count(filter?: Partial<T>): Promise<Result<number, Error>> {
    const filterWithSoftDelete = {
      ...filter,
      deletedAt: null,
    };

    return await super.count(filterWithSoftDelete);
  }

  /**
   * Soft delete a record (set deletedAt timestamp)
   */
  async softDelete(id: K): Promise<Result<void, Error>> {
    try {
      const [result] = await this.db
        .update(this.table)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(and(eq(this.table.id, id as any), isNull(this.table.deletedAt)))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new DatabaseError("Record not found or already deleted"),
        };
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to soft delete record", error),
      };
    }
  }

  /**
   * Restore a soft-deleted record (set deletedAt to null)
   */
  async restore(id: K): Promise<Result<T, Error>> {
    try {
      const [result] = await this.db
        .update(this.table)
        .set({
          deletedAt: null,
          updatedAt: new Date(),
        } as any)
        .where(
          and(eq(this.table.id, id as any), isNotNull(this.table.deletedAt))
        )
        .returning();

      if (!result) {
        return {
          success: false,
          error: new DatabaseError("Record not found or not deleted"),
        };
      }

      return { success: true, data: result as T };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to restore record", error),
      };
    }
  }

  /**
   * Find soft-deleted records
   */
  async findDeleted(options?: FilterOptions<T>): Promise<Result<T[], Error>> {
    try {
      const filterWithDeleted = {
        ...options,
        where: {
          ...options?.where,
          // Override any deletedAt filter to only show deleted records
        },
      };

      let query = this.db.select().from(this.table);

      // Apply where conditions but ensure we only get deleted records
      if (filterWithDeleted?.where) {
        const whereConditions = this.buildWhereConditions(
          filterWithDeleted.where
        );
        if (whereConditions) {
          query = query.where(
            and(whereConditions, isNotNull(this.table.deletedAt))
          );
        } else {
          query = query.where(isNotNull(this.table.deletedAt));
        }
      } else {
        query = query.where(isNotNull(this.table.deletedAt));
      }

      // Apply sorting
      if (options?.orderBy && options.orderBy.length > 0) {
        const orderByConditions = options.orderBy.map((sort) =>
          this.buildOrderByCondition(sort)
        );
        query = query.orderBy(...orderByConditions);
      }

      // Apply pagination
      if (options?.pagination) {
        const { limit, offset } = options.pagination;
        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);
      }

      const result = await query;

      return { success: true, data: result as T[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to find deleted records", error),
      };
    }
  }

  /**
   * Permanently delete a record (hard delete)
   */
  async permanentDelete(id: K): Promise<Result<void, Error>> {
    try {
      const result = await this.db
        .delete(this.table)
        .where(eq(this.table.id, id as any))
        .returning();

      if (result.length === 0) {
        return {
          success: false,
          error: new DatabaseError("Record not found for permanent deletion"),
        };
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError("Failed to permanently delete record", error),
      };
    }
  }

  /**
   * Override delete to perform soft delete instead of hard delete
   */
  async delete(id: K): Promise<Result<void, Error>> {
    return await this.softDelete(id);
  }
}
