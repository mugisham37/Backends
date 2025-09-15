himport type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

/**
 * Database health check result
 */
export interface DatabaseHealthCheck {
  healthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * Base entity interface with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Pagination result
 */
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

/**
 * Filter options for database queries
 */
export interface FilterOptions<T = Record<string, unknown>> {
  where?: Partial<T>;
  orderBy?: {
    field: keyof T;
    direction: "asc" | "desc";
  }[];
  pagination?: PaginationParams;
}

/**
 * Database transaction context
 */
export interface TransactionContext {
  rollback(): Promise<void>;
  commit(): Promise<void>;
}

/**
 * Query result wrapper
 */
export type QueryResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: DatabaseError;
    };

/**
 * Database error types
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONNECTION_ERROR", cause);
    this.name = "ConnectionError";
  }
}

export class QueryError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "QUERY_ERROR", cause);
    this.name = "QueryError";
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "VALIDATION_ERROR", cause);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "NOT_FOUND", cause);
    this.name = "NotFoundError";
  }
}

export class DuplicateError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "DUPLICATE_ERROR", cause);
    this.name = "DuplicateError";
  }
}

/**
 * Utility types for schema inference
 */
export type InsertModel<T> = InferInsertModel<T>;
export type SelectModel<T> = InferSelectModel<T>;
