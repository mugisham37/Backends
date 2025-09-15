import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { Result } from "./result.types";

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
  connectionTimeout?: number;
  idleTimeout?: number;
  acquireTimeout?: number;
}

/**
 * Database health check result
 */
export interface DatabaseHealthCheck {
  healthy: boolean;
  latency?: number;
  error?: string;
  connectionCount?: number;
  activeConnections?: number;
  idleConnections?: number;
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
 * Soft delete entity interface
 */
export interface SoftDeleteEntity extends BaseEntity {
  deletedAt?: Date | null;
}

/**
 * Tenant-scoped entity interface
 */
export interface TenantEntity extends BaseEntity {
  tenantId: string;
}

/**
 * Versioned entity interface
 */
export interface VersionedEntity extends BaseEntity {
  version: number;
}

/**
 * Auditable entity interface
 */
export interface AuditableEntity extends BaseEntity {
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
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
    cursor?: string;
  };
}

/**
 * Sorting options
 */
export interface SortOptions<T = Record<string, unknown>> {
  field: keyof T;
  direction: "asc" | "desc";
}

/**
 * Filter options for database queries
 */
export interface FilterOptions<T = Record<string, unknown>> {
  where?: Partial<T> & {
    // Special filter operators
    _and?: Array<Partial<T>>;
    _or?: Array<Partial<T>>;
    _not?: Partial<T>;
  };
  orderBy?: SortOptions<T>[];
  pagination?: PaginationParams;
  include?: string[];
  select?: (keyof T)[];
}

/**
 * Database transaction context
 */
export interface TransactionContext {
  rollback(): Promise<void>;
  commit(): Promise<void>;
  isActive(): boolean;
  id: string;
}

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Repository interface for CRUD operations
 */
export interface IRepository<T, K = string> {
  create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<T, Error>>;
  findById(id: K): Promise<Result<T | null, Error>>;
  findOne(filter: Partial<T>): Promise<Result<T | null, Error>>;
  findMany(options?: FilterOptions<T>): Promise<Result<T[], Error>>;
  findManyPaginated(
    options?: FilterOptions<T>
  ): Promise<Result<PaginatedResult<T>, Error>>;
  update(id: K, data: Partial<T>): Promise<Result<T, Error>>;
  delete(id: K): Promise<Result<void, Error>>;
  count(filter?: Partial<T>): Promise<Result<number, Error>>;
  exists(filter: Partial<T>): Promise<Result<boolean, Error>>;
}

/**
 * Tenant-aware repository interface
 */
export interface ITenantRepository<T extends TenantEntity, K = string>
  extends IRepository<T, K> {
  findByTenant(
    tenantId: string,
    options?: FilterOptions<T>
  ): Promise<Result<T[], Error>>;
  findByTenantPaginated(
    tenantId: string,
    options?: FilterOptions<T>
  ): Promise<Result<PaginatedResult<T>, Error>>;
  countByTenant(
    tenantId: string,
    filter?: Partial<T>
  ): Promise<Result<number, Error>>;
}

/**
 * Soft delete repository interface
 */
export interface ISoftDeleteRepository<T extends SoftDeleteEntity, K = string>
  extends IRepository<T, K> {
  softDelete(id: K): Promise<Result<void, Error>>;
  restore(id: K): Promise<Result<T, Error>>;
  findDeleted(options?: FilterOptions<T>): Promise<Result<T[], Error>>;
  permanentDelete(id: K): Promise<Result<void, Error>>;
}

/**
 * Database migration interface
 */
export interface Migration {
  id: string;
  name: string;
  version: string;
  up(): Promise<void>;
  down(): Promise<void>;
  createdAt: Date;
}

/**
 * Migration runner interface
 */
export interface MigrationRunner {
  run(): Promise<void>;
  rollback(steps?: number): Promise<void>;
  status(): Promise<Migration[]>;
  reset(): Promise<void>;
}

/**
 * Database schema definition
 */
export interface SchemaDefinition {
  tables: Record<string, TableDefinition>;
  relations: Record<string, RelationDefinition>;
  indexes: Record<string, IndexDefinition>;
}

/**
 * Table definition
 */
export interface TableDefinition {
  name: string;
  columns: Record<string, ColumnDefinition>;
  primaryKey: string[];
  foreignKeys?: ForeignKeyDefinition[];
  uniqueConstraints?: UniqueConstraintDefinition[];
  checkConstraints?: CheckConstraintDefinition[];
}

/**
 * Column definition
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  default?: unknown;
  autoIncrement?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
}

/**
 * Relation definition
 */
export interface RelationDefinition {
  type: "one-to-one" | "one-to-many" | "many-to-many";
  from: { table: string; column: string };
  to: { table: string; column: string };
  through?: { table: string; fromColumn: string; toColumn: string };
}

/**
 * Index definition
 */
export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type?: "btree" | "hash" | "gin" | "gist";
}

/**
 * Foreign key definition
 */
export interface ForeignKeyDefinition {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: "cascade" | "restrict" | "set null" | "set default";
  onUpdate?: "cascade" | "restrict" | "set null" | "set default";
}

/**
 * Unique constraint definition
 */
export interface UniqueConstraintDefinition {
  name: string;
  columns: string[];
}

/**
 * Check constraint definition
 */
export interface CheckConstraintDefinition {
  name: string;
  expression: string;
}

/**
 * Database entity types for the application
 */

/**
 * User entity
 */
export interface User extends AuditableEntity, TenantEntity {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Tenant entity
 */
export interface Tenant extends AuditableEntity {
  name: string;
  slug: string;
  domain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive: boolean;
}

/**
 * Content entity
 */
export interface Content
  extends AuditableEntity,
    TenantEntity,
    VersionedEntity,
    SoftDeleteEntity {
  title: string;
  slug: string;
  body?: string;
  excerpt?: string;
  status: "draft" | "published" | "archived";
  publishedAt?: Date;
  authorId: string;
  categoryId?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
}

/**
 * Content version entity
 */
export interface ContentVersion extends BaseEntity {
  contentId: string;
  version: number;
  title: string;
  body?: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

/**
 * Media entity
 */
export interface Media extends AuditableEntity, TenantEntity, SoftDeleteEntity {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  caption?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
  uploadedBy: string;
}

/**
 * Category entity
 */
export interface Category
  extends AuditableEntity,
    TenantEntity,
    SoftDeleteEntity {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Utility types for schema inference
 */
export type InsertModel<T> = InferInsertModel<T>;
export type SelectModel<T> = InferSelectModel<T>;

/**
 * Database operation result types
 */
export type DatabaseResult<T> = Result<T, Error>;
export type DatabaseListResult<T> = Result<T[], Error>;
export type DatabasePaginatedResult<T> = Result<PaginatedResult<T>, Error>;
