import { eq, and, or, count, desc, asc, SQL, sql } from "drizzle-orm";
import { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { getDatabase } from "../database/connection.js";
import type {
  IRepository,
  FilterOptions,
  PaginatedResult,
  SortOptions,
} from "../types/database.types.js";
import type { Result } from "../types/result.types.js";
import { DatabaseError } from "../errors/database.error.js";

/**
 * Base repository implementation with Drizzle ORM
 * Provides common CRUD operations with type safety
 */
export abstract class BaseRepository<
  T extends Record<string, unknown>,
  K = string
> implements IRepository<T, K>
{
  protected readonly db = getDatabase();

  constructor(protected readonly table: PgTable<TableConfig>) {}

  /**
   * Create a new record
   */
  async create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<T, Error>> {
    try {
      const [result] = await this.db
        .insert(this.table)
        .values(data as any)
        .returning();

      return { success: true, data: result as T };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create record",
          "create",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find record by ID
   */
  async findById(id: K): Promise<Result<T | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(this.table)
        .where(eq((this.table as any).id, id))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? (result[0] as T) : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find record by ID",
          "findById",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find single record by filter
   */
  async findOne(filter: Partial<T>): Promise<Result<T | null, Error>> {
    try {
      const whereConditions = this.buildWhereConditions(filter);

      const result = whereConditions
        ? await this.db
            .select()
            .from(this.table)
            .where(whereConditions)
            .limit(1)
        : await this.db.select().from(this.table).limit(1);

      return {
        success: true,
        data: result.length > 0 ? (result[0] as T) : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find record",
          "findOne",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find multiple records with filtering and sorting
   */
  async findMany(options?: FilterOptions<T>): Promise<Result<T[], Error>> {
    try {
      let query = this.db.select().from(this.table);

      // Apply where conditions
      if (options?.where) {
        const whereConditions = this.buildWhereConditions(options.where);
        if (whereConditions) {
          query = query.where(whereConditions) as any;
        }
      }

      // Apply sorting
      if (options?.orderBy && options.orderBy.length > 0) {
        const orderByConditions = options.orderBy.map((sort) =>
          this.buildOrderByCondition(sort)
        );
        query = query.orderBy(...orderByConditions) as any;
      }

      // Apply pagination
      if (options?.pagination) {
        const { limit, offset } = options.pagination;
        if (limit) query = query.limit(limit) as any;
        if (offset) query = query.offset(offset) as any;
      }

      const result = await query;

      return { success: true, data: result as T[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find records",
          "findMany",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find records with pagination metadata
   */
  async findManyPaginated(
    options?: FilterOptions<T>
  ): Promise<Result<PaginatedResult<T>, Error>> {
    try {
      const page = options?.pagination?.page || 1;
      const limit = options?.pagination?.limit || 20;
      const offset = (page - 1) * limit;

      // Get total count
      let countQuery = this.db.select({ count: count() }).from(this.table);
      if (options?.where) {
        const whereConditions = this.buildWhereConditions(options.where);
        if (whereConditions) {
          countQuery = countQuery.where(whereConditions) as any;
        }
      }

      const countResult = await countQuery;
      const totalCount = countResult[0]?.count || 0;

      // Get data
      const dataResult = await this.findMany({
        ...options,
        pagination: { ...options?.pagination, limit, offset },
      });

      if (!dataResult.success) {
        return dataResult as Result<PaginatedResult<T>, Error>;
      }

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          data: dataResult.data,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find paginated records",
          "findManyPaginated",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update record by ID
   */
  async update(id: K, data: Partial<T>): Promise<Result<T, Error>> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
      } as any;

      const [result] = await this.db
        .update(this.table)
        .set(updateData)
        .where(eq((this.table as any).id, id))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new DatabaseError(
            "Record not found for update",
            "update",
            this.table._.name
          ),
        };
      }

      return { success: true, data: result as T };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update record",
          "update",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Delete record by ID
   */
  async delete(id: K): Promise<Result<void, Error>> {
    try {
      const result = await this.db
        .delete(this.table)
        .where(eq((this.table as any).id, id))
        .returning();

      if (result.length === 0) {
        return {
          success: false,
          error: new DatabaseError(
            "Record not found for deletion",
            "delete",
            this.table._.name
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to delete record",
          "delete",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Count records matching filter
   */
  async count(filter?: Partial<T>): Promise<Result<number, Error>> {
    try {
      let query = this.db.select({ count: count() }).from(this.table);

      if (filter) {
        const whereConditions = this.buildWhereConditions(filter);
        if (whereConditions) {
          query = query.where(whereConditions) as any;
        }
      }

      const result = await query;
      const totalCount = result[0]?.count || 0;

      return { success: true, data: totalCount };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to count records",
          "count",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Check if record exists matching filter
   */
  async exists(filter: Partial<T>): Promise<Result<boolean, Error>> {
    try {
      const countResult = await this.count(filter);
      if (!countResult.success) {
        return countResult as Result<boolean, Error>;
      }

      return { success: true, data: countResult.data > 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check record existence",
          "exists",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Build WHERE conditions from filter object
   */
  protected buildWhereConditions(
    filter: Partial<T> & {
      _and?: Array<Partial<T>>;
      _or?: Array<Partial<T>>;
      _not?: Partial<T>;
    }
  ): SQL | undefined {
    const conditions: SQL[] = [];

    // Handle special operators
    if (filter._and) {
      const andConditions = filter._and
        .map((f) => this.buildWhereConditions(f))
        .filter(Boolean) as SQL[];
      if (andConditions.length > 0) {
        conditions.push(and(...andConditions)!);
      }
    }

    if (filter._or) {
      const orConditions = filter._or
        .map((f) => this.buildWhereConditions(f))
        .filter(Boolean) as SQL[];
      if (orConditions.length > 0) {
        conditions.push(or(...orConditions)!);
      }
    }

    if (filter._not) {
      const notCondition = this.buildWhereConditions(filter._not);
      if (notCondition) {
        conditions.push(sql`NOT (${notCondition})`);
      }
    }

    // Handle regular field conditions
    for (const [key, value] of Object.entries(filter)) {
      if (key.startsWith("_") || value === undefined) continue;

      const column = (this.table as any)[key];
      if (column) {
        conditions.push(eq(column, value));
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Build ORDER BY condition from sort options
   */
  protected buildOrderByCondition(sort: SortOptions<T>): SQL {
    const column = (this.table as any)[sort.field];
    return sort.direction === "desc" ? desc(column) : asc(column);
  }
}
