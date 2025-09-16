/**
 * Enhanced base repository with performance monitoring and caching
 * Provides common database operations and patterns for all repositories
 */

import { eq, and, or, desc, asc, count, SQL, sql } from "drizzle-orm";
import { PgTable, PgColumn } from "drizzle-orm/pg-core";
import type { Database } from "../database/connection";

// Enhanced query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    direction: "asc" | "desc";
  };
  pagination?: {
    page?: number;
    limit?: number;
    offset?: number;
  };
  sort?: Array<{
    field: string;
    direction: "asc" | "desc";
  }>;
  filters?: Record<string, any>;
  include?: string[];
}

// Enhanced pagination result
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Base repository interface
export interface IBaseRepository<
  T,
  TInsert extends Record<string, any>,
  TUpdate = Partial<TInsert>
> {
  findById(id: string): Promise<T | null>;
  findMany(options?: QueryOptions): Promise<T[]>;
  findByIds(ids: string[]): Promise<T[]>;
  create(data: TInsert): Promise<T>;
  createMany(data: TInsert[]): Promise<T[]>;
  update(id: string, data: TUpdate): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(where?: SQL): Promise<number>;
  paginate(
    page: number,
    limit: number,
    where?: SQL
  ): Promise<PaginatedResult<T>>;
  exists(id: string): Promise<boolean>;
}

// Enhanced base repository implementation
export abstract class BaseRepository<
  T,
  TInsert extends Record<string, any>,
  TUpdate = Partial<TInsert>
> implements IBaseRepository<T, TInsert, TUpdate>
{
  protected abstract table: PgTable;
  protected abstract idColumn: PgColumn;
  protected abstract tableName: string;

  constructor(protected db: Database) {}

  async findById(id: string): Promise<T | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.idColumn, id))
      .limit(1);

    return (result[0] as T) || null;
  }

  async findMany(options: QueryOptions = {}): Promise<T[]> {
    // Build query with all options at once to avoid type issues
    let baseQuery = this.db.select().from(this.table);

    // Apply all conditions in a single chain
    if (options.orderBy) {
      const orderFn = options.orderBy.direction === "desc" ? desc : asc;
      const column = this.table[
        options.orderBy.column as keyof typeof this.table
      ] as PgColumn;
      if (column) {
        if (options.limit && options.offset) {
          const result = await baseQuery
            .orderBy(orderFn(column))
            .limit(options.limit)
            .offset(options.offset);
          return result as T[];
        } else if (options.limit) {
          const result = await baseQuery
            .orderBy(orderFn(column))
            .limit(options.limit);
          return result as T[];
        } else if (options.offset) {
          const result = await baseQuery
            .orderBy(orderFn(column))
            .offset(options.offset);
          return result as T[];
        } else {
          const result = await baseQuery.orderBy(orderFn(column));
          return result as T[];
        }
      }
    }

    // No ordering
    if (options.limit && options.offset) {
      const result = await baseQuery
        .limit(options.limit)
        .offset(options.offset);
      return result as T[];
    } else if (options.limit) {
      const result = await baseQuery.limit(options.limit);
      return result as T[];
    } else if (options.offset) {
      const result = await baseQuery.offset(options.offset);
      return result as T[];
    }

    const result = await baseQuery;
    return result as T[];
  }

  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];

    const result = await this.db
      .select()
      .from(this.table)
      .where(sql`${this.idColumn} = ANY(${ids})`);

    return result as T[];
  }

  async create(data: TInsert): Promise<T> {
    const result = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();

    return result[0] as T;
  }

  async createMany(data: TInsert[]): Promise<T[]> {
    if (data.length === 0) return [];

    const result = await this.db
      .insert(this.table)
      .values(data as any[])
      .returning();

    return result as T[];
  }

  async update(id: string, data: TUpdate): Promise<T | null> {
    const result = await this.db
      .update(this.table)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(eq(this.idColumn, id))
      .returning();

    return (result[0] as T) || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.idColumn, id))
      .returning();

    return result.length > 0;
  }

  async count(where?: SQL): Promise<number> {
    // Execute query directly to avoid type issues
    if (where) {
      const result = await this.db
        .select({ count: count() })
        .from(this.table)
        .where(where);
      return result[0]?.count || 0;
    } else {
      const result = await this.db.select({ count: count() }).from(this.table);
      return result[0]?.count || 0;
    }
  }

  async paginate(
    page: number = 1,
    limit: number = 10,
    where?: SQL
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * limit;

    // Get total count
    const totalCount = await this.count(where);

    // Get paginated data - execute directly to avoid type issues
    let data: any[];
    if (where) {
      data = await this.db
        .select()
        .from(this.table)
        .where(where)
        .limit(limit)
        .offset(offset);
    } else {
      data = await this.db
        .select()
        .from(this.table)
        .limit(limit)
        .offset(offset);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: data as T[],
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.idColumn })
      .from(this.table)
      .where(eq(this.idColumn, id))
      .limit(1);

    return result.length > 0;
  }

  // Helper methods for common query patterns
  protected buildWhereClause(filters: Record<string, any>): SQL | undefined {
    const conditions: SQL[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        const column = this.table[key as keyof typeof this.table] as PgColumn;
        if (column) {
          if (Array.isArray(value)) {
            conditions.push(sql`${column} = ANY(${value})`);
          } else {
            conditions.push(eq(column, value));
          }
        }
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  protected buildOrWhereClause(filters: Record<string, any>): SQL | undefined {
    const conditions: SQL[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        const column = this.table[key as keyof typeof this.table] as PgColumn;
        if (column) {
          conditions.push(eq(column, value));
        }
      }
    }

    return conditions.length > 0 ? or(...conditions) : undefined;
  }

  // Helper methods for advanced querying
  protected buildWhereConditions(filters: Record<string, any>): SQL[] {
    const conditions: SQL[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      const column = this.table[key as keyof typeof this.table] as PgColumn;
      if (!column) continue;

      if (Array.isArray(value)) {
        conditions.push(sql`${column} = ANY(${value})`);
      } else if (
        typeof value === "object" &&
        value !== null &&
        "operator" in value &&
        "value" in value
      ) {
        const filterValue = value as { operator: string; value: any };
        switch (filterValue.operator) {
          case "gt":
            conditions.push(sql`${column} > ${filterValue.value}`);
            break;
          case "gte":
            conditions.push(sql`${column} >= ${filterValue.value}`);
            break;
          case "lt":
            conditions.push(sql`${column} < ${filterValue.value}`);
            break;
          case "lte":
            conditions.push(sql`${column} <= ${filterValue.value}`);
            break;
          case "like":
            conditions.push(sql`${column} ILIKE ${`%${filterValue.value}%`}`);
            break;
          case "in":
            conditions.push(sql`${column} = ANY(${filterValue.value})`);
            break;
          case "not":
            conditions.push(sql`${column} != ${filterValue.value}`);
            break;
        }
      } else {
        conditions.push(eq(column, value));
      }
    }

    return conditions;
  }

  protected buildOrderBy(
    sortOptions: Array<{ field: string; direction: "asc" | "desc" }>
  ): SQL[] {
    const orderBy: SQL[] = [];

    for (const sort of sortOptions) {
      const column = this.table[
        sort.field as keyof typeof this.table
      ] as PgColumn;
      if (!column) continue;

      if (sort.direction === "desc") {
        orderBy.push(desc(column));
      } else {
        orderBy.push(asc(column));
      }
    }

    return orderBy;
  }

  /**
   * Enhanced paginate method with advanced options
   */
  async paginateAdvanced(
    options: QueryOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      pagination = { page: 1, limit: 20 },
      sort = [],
      filters = {},
    } = options;
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // Build where conditions from filters
    const whereConditions = this.buildWhereConditions(filters);
    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const totalCount = await this.count(whereClause);

    // Build order by clause
    const orderByClause = this.buildOrderBy(sort);

    // Execute query with all conditions
    let data: any[];
    if (whereClause && orderByClause.length > 0) {
      data = await this.db
        .select()
        .from(this.table)
        .where(whereClause)
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset);
    } else if (whereClause) {
      data = await this.db
        .select()
        .from(this.table)
        .where(whereClause)
        .limit(limit)
        .offset(offset);
    } else if (orderByClause.length > 0) {
      data = await this.db
        .select()
        .from(this.table)
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset);
    } else {
      data = await this.db
        .select()
        .from(this.table)
        .limit(limit)
        .offset(offset);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: data as T[],
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Transaction wrapper
   */
  async transaction<TResult>(
    callback: (tx: Database) => Promise<TResult>
  ): Promise<TResult> {
    return await this.db.transaction(callback);
  }

  /**
   * Raw SQL execution
   */
  async rawQuery<TResult = any>(
    query: string,
    params: any[] = []
  ): Promise<TResult[]> {
    return (await this.db.execute(sql.raw(query))) as TResult[];
  }
}
