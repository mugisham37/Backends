/**
 * Base repository interface and abstract class
 * Provides common database operations and patterns for all repositories
 */

import { eq, and, or, desc, asc, count, SQL, sql } from "drizzle-orm";
import { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { Database } from "../database/connection";

// Common query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    direction: "asc" | "desc";
  };
}

// Pagination result
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Base repository interface
export interface IBaseRepository<T, TInsert, TUpdate = Partial<TInsert>> {
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

// Abstract base repository implementation
export abstract class BaseRepository<T, TInsert, TUpdate = Partial<TInsert>>
  implements IBaseRepository<T, TInsert, TUpdate>
{
  protected abstract table: PgTable;
  protected abstract idColumn: PgColumn;

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
    let query = this.db.select().from(this.table);

    if (options.orderBy) {
      const orderFn = options.orderBy.direction === "desc" ? desc : asc;
      query = query.orderBy(
        orderFn(this.table[options.orderBy.column as keyof typeof this.table])
      );
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query as Promise<T[]>;
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
    const result = await this.db.insert(this.table).values(data).returning();

    return result[0] as T;
  }

  async createMany(data: TInsert[]): Promise<T[]> {
    if (data.length === 0) return [];

    const result = await this.db.insert(this.table).values(data).returning();

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
    let query = this.db.select({ count: count() }).from(this.table);

    if (where) {
      query = query.where(where);
    }

    const result = await query;
    return result[0]?.count || 0;
  }

  async paginate(
    page: number = 1,
    limit: number = 10,
    where?: SQL
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * limit;

    // Get total count
    const totalCount = await this.count(where);

    // Get paginated data
    let query = this.db.select().from(this.table);

    if (where) {
      query = query.where(where);
    }

    const data = await query.limit(limit).offset(offset);

    return {
      data: data as T[],
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
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
}
