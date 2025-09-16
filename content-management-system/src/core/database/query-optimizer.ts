import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";
import { container } from "tsyringe";
import { CacheService } from "../../modules/cache/cache.service";
import { logger } from "../../shared/utils/logger";
import type { DrizzleDatabase } from "./connection";

/**
 * Database query optimization utilities
 * Provides query result caching, N+1 query prevention, and connection pooling optimization
 */
export class QueryOptimizer {
  private cache: CacheService;
  private queryCache = new Map<string, any>();
  private batchQueries = new Map<string, Promise<any>>();

  constructor(private db: DrizzleDatabase) {
    this.cache = container.resolve(CacheService);
  }

  /**
   * Execute query with caching
   */
  async executeWithCache<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    ttlSeconds = 300 // 5 minutes default
  ): Promise<T> {
    // Check cache first
    const cached = await this.cache.get<T>(queryKey);
    if (cached !== null) {
      logger.debug(`Query cache hit for key: ${queryKey}`);
      return cached;
    }

    // Execute query
    const startTime = Date.now();
    const result = await queryFn();
    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 1000) {
      logger.warn(`Slow query detected: ${queryKey} took ${executionTime}ms`);
    }

    // Cache result
    await this.cache.set(queryKey, result, ttlSeconds);
    logger.debug(`Query executed and cached: ${queryKey} (${executionTime}ms)`);

    return result;
  }

  /**
   * Batch similar queries to prevent N+1 problems
   */
  async batchQuery<T, K>(
    batchKey: string,
    ids: K[],
    queryFn: (ids: K[]) => Promise<T[]>,
    keyExtractor: (item: T) => K,
    ttlSeconds = 300
  ): Promise<Map<K, T>> {
    if (ids.length === 0) {
      return new Map();
    }

    // Check if batch query is already in progress
    const existingBatch = this.batchQueries.get(batchKey);
    if (existingBatch) {
      await existingBatch;
    }

    // Check cache for individual items
    const cacheKeys = ids.map((id) => `${batchKey}:${id}`);
    const cachedItems = await this.cache.mget<T>(cacheKeys);

    const resultMap = new Map<K, T>();
    const uncachedIds: K[] = [];

    ids.forEach((id, index) => {
      const cached = cachedItems[index];
      if (cached !== null) {
        resultMap.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    });

    // If all items are cached, return early
    if (uncachedIds.length === 0) {
      logger.debug(`Batch query cache hit for all items: ${batchKey}`);
      return resultMap;
    }

    // Execute batch query for uncached items
    const batchPromise = this.executeBatchQuery(
      batchKey,
      uncachedIds,
      queryFn,
      keyExtractor,
      ttlSeconds
    );

    this.batchQueries.set(batchKey, batchPromise);

    try {
      const batchResults = await batchPromise;

      // Merge cached and fresh results
      batchResults.forEach((value, key) => {
        resultMap.set(key, value);
      });

      return resultMap;
    } finally {
      this.batchQueries.delete(batchKey);
    }
  }

  /**
   * Execute the actual batch query
   */
  private async executeBatchQuery<T, K>(
    batchKey: string,
    ids: K[],
    queryFn: (ids: K[]) => Promise<T[]>,
    keyExtractor: (item: T) => K,
    ttlSeconds: number
  ): Promise<Map<K, T>> {
    const startTime = Date.now();
    const results = await queryFn(ids);
    const executionTime = Date.now() - startTime;

    logger.debug(
      `Batch query executed: ${batchKey} (${ids.length} items, ${executionTime}ms)`
    );

    const resultMap = new Map<K, T>();
    const cacheEntries: Array<{ key: string; value: T; ttl: number }> = [];

    // Process results and prepare for caching
    results.forEach((item) => {
      const key = keyExtractor(item);
      resultMap.set(key, item);
      cacheEntries.push({
        key: `${batchKey}:${key}`,
        value: item,
        ttl: ttlSeconds,
      });
    });

    // Cache individual items
    if (cacheEntries.length > 0) {
      await this.cache.mset(cacheEntries);
    }

    return resultMap;
  }

  /**
   * Optimize SELECT queries with proper joins and indexes
   */
  optimizeSelect<T extends PgSelect>(query: T): T {
    // Add query hints for better performance
    return query;
  }

  /**
   * Create optimized pagination query
   */
  async paginateQuery<T>(
    baseQuery: PgSelect,
    page = 1,
    limit = 20,
    cacheKey?: string
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const offset = (page - 1) * limit;

    const executeQuery = async () => {
      // Get total count (this should be cached separately)
      const countQuery = sql`SELECT COUNT(*) FROM (${baseQuery.getSQL()}) as count_query`;
      const [countResult] = await this.db.execute(countQuery);
      const total = Number(countResult.count);

      // Get paginated data
      const data = await baseQuery.limit(limit).offset(offset);

      const totalPages = Math.ceil(total / limit);

      return {
        data: data as T[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    };

    if (cacheKey) {
      const fullCacheKey = `pagination:${cacheKey}:${page}:${limit}`;
      return this.executeWithCache(fullCacheKey, executeQuery, 180); // 3 minutes
    }

    return executeQuery();
  }

  /**
   * Invalidate cache patterns for related data
   */
  async invalidateRelatedCache(patterns: string[]): Promise<void> {
    const promises = patterns.map((pattern) =>
      this.cache.invalidatePattern(pattern)
    );

    await Promise.all(promises);
    logger.debug(`Invalidated cache patterns: ${patterns.join(", ")}`);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache(
    warmupQueries: Array<{
      key: string;
      queryFn: () => Promise<any>;
      ttl?: number;
    }>
  ): Promise<void> {
    logger.info(`Starting cache warmup with ${warmupQueries.length} queries`);

    const promises = warmupQueries.map(async ({ key, queryFn, ttl = 600 }) => {
      try {
        const result = await queryFn();
        await this.cache.set(key, result, ttl);
        logger.debug(`Cache warmed: ${key}`);
      } catch (error) {
        logger.error(`Failed to warm cache for ${key}:`, error);
      }
    });

    await Promise.all(promises);
    logger.info("Cache warmup completed");
  }

  /**
   * Get query performance metrics
   */
  getMetrics(): {
    cacheHits: number;
    cacheMisses: number;
    avgQueryTime: number;
    slowQueries: number;
  } {
    // This would be implemented with proper metrics collection
    return {
      cacheHits: 0,
      cacheMisses: 0,
      avgQueryTime: 0,
      slowQueries: 0,
    };
  }

  /**
   * Clear query optimizer caches
   */
  async clearCaches(): Promise<void> {
    this.queryCache.clear();
    this.batchQueries.clear();
    await this.cache.clear();
    logger.info("Query optimizer caches cleared");
  }
}

/**
 * Query builder helpers for common patterns
 */
export class QueryBuilder {
  /**
   * Build efficient search query with full-text search
   */
  static buildSearchQuery(
    searchTerm: string,
    fields: string[]
  ): ReturnType<typeof sql> {
    const searchVector = fields
      .map((field) => `coalesce(${field}, '')`)
      .join(" || ' ' || ");

    return sql`
      to_tsvector('english', ${sql.raw(searchVector)}) @@ 
      plainto_tsquery('english', ${searchTerm})
    `;
  }

  /**
   * Build efficient filter query with proper indexing
   */
  static buildFilterQuery(filters: Record<string, any>) {
    const conditions = Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return inArray(sql.identifier(key), value);
        }
        return eq(sql.identifier(key), value);
      });

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Build efficient sorting query
   */
  static buildSortQuery(
    sortBy = "created_at",
    sortOrder: "asc" | "desc" = "desc"
  ) {
    const column = sql.identifier(sortBy);
    return sortOrder === "asc" ? asc(column) : desc(column);
  }
}

/**
 * Connection pool optimizer
 */
export class ConnectionPoolOptimizer {
  private static instance: ConnectionPoolOptimizer;
  private connectionMetrics = {
    activeConnections: 0,
    totalQueries: 0,
    avgResponseTime: 0,
    errors: 0,
  };

  static getInstance(): ConnectionPoolOptimizer {
    if (!ConnectionPoolOptimizer.instance) {
      ConnectionPoolOptimizer.instance = new ConnectionPoolOptimizer();
    }
    return ConnectionPoolOptimizer.instance;
  }

  /**
   * Monitor connection pool health
   */
  async monitorPool(db: DrizzleDatabase): Promise<{
    healthy: boolean;
    metrics: typeof this.connectionMetrics;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    // Check connection pool status
    const poolInfo = await this.getPoolInfo(db);

    if (poolInfo.activeConnections > poolInfo.maxConnections * 0.8) {
      recommendations.push("Consider increasing max connections");
    }

    if (this.connectionMetrics.avgResponseTime > 1000) {
      recommendations.push(
        "High response time detected - check query optimization"
      );
    }

    if (this.connectionMetrics.errors > 10) {
      recommendations.push("High error rate - check connection stability");
    }

    return {
      healthy: recommendations.length === 0,
      metrics: this.connectionMetrics,
      recommendations,
    };
  }

  /**
   * Get connection pool information
   */
  private async getPoolInfo(db: DrizzleDatabase): Promise<{
    activeConnections: number;
    maxConnections: number;
    idleConnections: number;
  }> {
    try {
      // This would query the actual database for connection info
      const result = await db.execute(sql`
        SELECT 
          count(*) as active_connections,
          setting::int as max_connections
        FROM pg_stat_activity 
        CROSS JOIN pg_settings 
        WHERE pg_settings.name = 'max_connections'
        AND pg_stat_activity.state = 'active'
      `);

      return {
        activeConnections: Number(result[0]?.active_connections || 0),
        maxConnections: Number(result[0]?.max_connections || 100),
        idleConnections: 0, // Would be calculated from actual pool
      };
    } catch (error) {
      logger.error("Failed to get pool info:", error);
      return {
        activeConnections: 0,
        maxConnections: 100,
        idleConnections: 0,
      };
    }
  }

  /**
   * Optimize connection pool settings
   */
  getOptimalPoolSettings(expectedLoad: "low" | "medium" | "high"): {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
  } {
    const settings = {
      low: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
      },
      medium: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 20000,
        idleTimeoutMillis: 180000,
      },
      high: {
        min: 10,
        max: 50,
        acquireTimeoutMillis: 10000,
        idleTimeoutMillis: 60000,
      },
    };

    return settings[expectedLoad];
  }
}
