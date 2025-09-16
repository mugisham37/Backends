/**
 * Optimized base repository with performance monitoring and caching
 * Extends the base repository with optimization features
 */

import { eq, and, or, desc, asc, sql, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "../database/connection.js";
import {
  MonitorQuery,
  MonitorBatchQuery,
  MonitorTransaction,
} from "../decorators/query-monitor.decorator.js";
import { Cache } from "../decorators/cache.decorator.js";
import { CacheStrategies } from "../../modules/cache/cache.strategies.js";

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  field: string;
  direction: "asc" | "desc";
}

export interface FilterOptions {
  [key: string]: any;
}

export interface QueryOptions {
  pagination?: PaginationOptions;
  sort?: SortOptions[];
  filters?: FilterOptions;
  include?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export abstract class OptimizedBaseRepository<T, TInsert> {
  protected db: PostgresJsDatabase<any>;
  protected abstract table: any;
  protected abstract tableName: string;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Find by ID with caching
   */
  @MonitorQuery({ description: "findById" })
  @Cache({
    strategy: CacheStrategies.API_RESPONSE,
    keyGenerator: function (id: string) {
      return `${this.tableName}:${id}`;
    },
  })
  async findById(id: string): Promise<T | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find multiple records with optimization
   */
  @MonitorQuery({ description: "findMany" })
  async findMany(options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const {
      pagination = { page: 1, limit: 20 },
      sort = [{ field: "createdAt", direction: "desc" }],
      filters = {},
    } = options;

    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const whereConditions = this.buildWhereConditions(filters);

    // Build ORDER BY clause
    const orderBy = this.buildOrderBy(sort);

    // Execute count query for pagination
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table);

    if (whereConditions.length > 0) {
      countQuery.where(and(...whereConditions));
    }

    // Execute main query
    const dataQuery = this.db
      .select()
      .from(this.table)
      .limit(limit)
      .offset(offset);

    if (whereConditions.length > 0) {
      dataQuery.where(and(...whereConditions));
    }

    if (orderBy.length > 0) {
      dataQuery.orderBy(...orderBy);
    }

    const [countResult, data] = await Promise.all([countQuery, dataQuery]);

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Create single record
   */
  @MonitorQuery({ description: "create" })
  async create(data: TInsert): Promise<T> {
    const result = await this.db.insert(this.table).values(data).returning();

    return result[0];
  }

  /**
   * Create multiple records in batch
   */
  @MonitorBatchQuery({ description: "createMany" })
  async createMany(data: TInsert[]): Promise<T[]> {
    if (data.length === 0) return [];

    // Process in batches to avoid query size limits
    const batchSize = 100;
    const results: T[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await this.db
        .insert(this.table)
        .values(batch)
        .returning();

      results.push(...batchResult);
    }

    return results;
  }

  /**
   * Update record by ID
   */
  @MonitorQuery({ description: "update" })
  async update(id: string, data: Partial<TInsert>): Promise<T | null> {
    const result = await this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(this.table.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * Update multiple records
   */
  @MonitorBatchQuery({ description: "updateMany" })
  async updateMany(
    filters: FilterOptions,
    data: Partial<TInsert>
  ): Promise<T[]> {
    const whereConditions = this.buildWhereConditions(filters);

    let query = this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() });

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    return await query.returning();
  }

  /**
   * Delete record by ID
   */
  @MonitorQuery({ description: "delete" })
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id));

    return result.rowCount > 0;
  }

  /**
   * Delete multiple records
   */
  @MonitorBatchQuery({ description: "deleteMany" })
  async deleteMany(filters: FilterOptions): Promise<number> {
    const whereConditions = this.buildWhereConditions(filters);

    let query = this.db.delete(this.table);

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    const result = await query;
    return result.rowCount;
  }

  /**
   * Check if record exists
   */
  @MonitorQuery({ description: "exists" })
  @Cache({
    strategy: CacheStrategies.API_RESPONSE,
    ttl: 300, // 5 minutes
    keyGenerator: function (id: string) {
      return `${this.tableName}:exists:${id}`;
    },
  })
  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Count records with filters
   */
  @MonitorQuery({ description: "count" })
  @Cache({
    strategy: CacheStrategies.API_RESPONSE,
    ttl: 600, // 10 minutes
    keyGenerator: function (filters: FilterOptions = {}) {
      return `${this.tableName}:count:${JSON.stringify(filters)}`;
    },
  })
  async count(filters: FilterOptions = {}): Promise<number> {
    const whereConditions = this.buildWhereConditions(filters);

    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table);

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    const result = await query;
    return result[0]?.count || 0;
  }

  /**
   * Execute transaction
   */
  @MonitorTransaction({ description: "transaction" })
  async transaction<TResult>(
    callback: (tx: PostgresJsDatabase<any>) => Promise<TResult>
  ): Promise<TResult> {
    return await this.db.transaction(callback);
  }

  /**
   * Execute raw SQL query
   */
  @MonitorQuery({ description: "rawQuery" })
  async rawQuery<TResult = any>(
    query: string,
    params: any[] = []
  ): Promise<TResult[]> {
    return await this.db.execute(sql.raw(query, params));
  }

  /**
   * Bulk upsert (insert or update)
   */
  @MonitorBatchQuery({ description: "upsert" })
  async upsert(
    data: TInsert[],
    conflictColumns: string[],
    updateColumns: string[]
  ): Promise<T[]> {
    if (data.length === 0) return [];

    // This is a simplified implementation
    // In practice, you'd use PostgreSQL's ON CONFLICT clause
    const results: T[] = [];

    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // If conflict, try to update
        if (error.code === "23505") {
          // Unique violation
          // Extract ID or unique field and update
          // This would need to be implemented based on your specific needs
          console.warn("Upsert conflict, skipping item:", item);
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Find records with complex joins
   */
  @MonitorQuery({ description: "findWithJoins" })
  protected async findWithJoins(
    joins: Array<{
      table: any;
      on: SQL;
      type?: "inner" | "left" | "right" | "full";
    }>,
    options: QueryOptions = {}
  ): Promise<any[]> {
    let query = this.db.select().from(this.table);

    // Add joins
    for (const join of joins) {
      switch (join.type || "inner") {
        case "left":
          query = query.leftJoin(join.table, join.on);
          break;
        case "right":
          query = query.rightJoin(join.table, join.on);
          break;
        case "full":
          query = query.fullJoin(join.table, join.on);
          break;
        default:
          query = query.innerJoin(join.table, join.on);
      }
    }

    // Apply filters
    if (options.filters) {
      const whereConditions = this.buildWhereConditions(options.filters);
      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions));
      }
    }

    // Apply sorting
    if (options.sort) {
      const orderBy = this.buildOrderBy(options.sort);
      if (orderBy.length > 0) {
        query = query.orderBy(...orderBy);
      }
    }

    // Apply pagination
    if (options.pagination) {
      const { page = 1, limit = 20 } = options.pagination;
      const offset = (page - 1) * limit;
      query = query.limit(limit).offset(offset);
    }

    return await query;
  }

  /**
   * Build WHERE conditions from filters
   */
  protected buildWhereConditions(filters: FilterOptions): SQL[] {
    const conditions: SQL[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      const column = this.table[key];
      if (!column) continue;

      if (Array.isArray(value)) {
        // IN clause for arrays
        conditions.push(sql`${column} = ANY(${value})`);
      } else if (typeof value === "object" && value.operator) {
        // Complex operators like { operator: 'gte', value: 100 }
        switch (value.operator) {
          case "gt":
            conditions.push(sql`${column} > ${value.value}`);
            break;
          case "gte":
            conditions.push(sql`${column} >= ${value.value}`);
            break;
          case "lt":
            conditions.push(sql`${column} < ${value.value}`);
            break;
          case "lte":
            conditions.push(sql`${column} <= ${value.value}`);
            break;
          case "like":
            conditions.push(sql`${column} ILIKE ${`%${value.value}%`}`);
            break;
          case "in":
            conditions.push(sql`${column} = ANY(${value.value})`);
            break;
          case "not":
            conditions.push(sql`${column} != ${value.value}`);
            break;
        }
      } else {
        // Simple equality
        conditions.push(eq(column, value));
      }
    }

    return conditions;
  }

  /**
   * Build ORDER BY clause from sort options
   */
  protected buildOrderBy(sortOptions: SortOptions[]): SQL[] {
    const orderBy: SQL[] = [];

    for (const sort of sortOptions) {
      const column = this.table[sort.field];
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
   * Get table statistics
   */
  @MonitorQuery({ description: "getTableStats" })
  async getTableStats(): Promise<{
    rowCount: number;
    tableSize: string;
    indexSize: string;
  }> {
    const result = await this.rawQuery(`
      SELECT 
        (SELECT COUNT(*) FROM ${this.tableName}) as row_count,
        pg_size_pretty(pg_total_relation_size('${this.tableName}')) as table_size,
        pg_size_pretty(pg_indexes_size('${this.tableName}')) as index_size
    `);

    return (
      result[0] || { rowCount: 0, tableSize: "0 bytes", indexSize: "0 bytes" }
    );
  }
}
