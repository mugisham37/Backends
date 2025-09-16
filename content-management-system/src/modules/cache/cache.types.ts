export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  namespace?: string;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  tags: string[];
}

export interface CacheStats {
  connected: boolean;
  keyCount: number;
  memoryUsage: string;
  hitRate?: number;
}

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  defaultTtl: number;
  maxRetries: number;
}

export interface SessionData {
  userId: string;
  tenantId?: string;
  role: string;
  permissions: string[];
  lastActivity: Date;
}

export interface SessionOptions {
  ttl?: number;
  sliding?: boolean;
  secure?: boolean;
}

export enum CacheEvent {
  SET = "set",
  GET = "get",
  DELETE = "delete",
  EXPIRE = "expire",
  FLUSH = "flush",
}
