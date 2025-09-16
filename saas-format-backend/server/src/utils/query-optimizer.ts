import { logger } from "./logger"
import { prisma } from "./prisma"
import { withDbMetrics } from "./metrics"

// Query optimization options
interface QueryOptimizationOptions {
  enableMetrics?: boolean
  logSlowQueries?: boolean
  slowQueryThreshold?: number // in milliseconds
  enableQueryCache?: boolean
  queryCacheTtl?: number // in seconds
}

// Default options
const DEFAULT_OPTIONS: QueryOptimizationOptions = {
  enableMetrics: true,
  logSlowQueries: true,
  slowQueryThreshold: 1000, // 1 second
  enableQueryCache: true,
  queryCacheTtl: 60, // 1 minute
}

// Query optimizer class
export class QueryOptimizer {
  private options: QueryOptimizationOptions

  constructor(options: Partial<QueryOptimizationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // Execute a query with optimization
  async executeQuery<T>(operation: string, queryFn: () => Promise<T>, cacheKey?: string): Promise<T> {
    const startTime = Date.now()

    try {
      let result: T

      // Use metrics if enabled
      if (this.options.enableMetrics) {
        result = await withDbMetrics(operation, queryFn)
      } else {
        result = await queryFn()
      }

      // Log slow queries if enabled
      const duration = Date.now() - startTime
      if (this.options.logSlowQueries && duration > (this.options.slowQueryThreshold || 0)) {
        logger.warn(`Slow query detected: ${operation} took ${duration}ms`)
      }

      return result
    } catch (error) {
      logger.error(`Query error in ${operation}:`, error)
      throw error
    }
  }

  // Get query execution plan
  async getQueryPlan(query: string): Promise<any> {
    try {
      const result = await prisma.$queryRawUnsafe(`EXPLAIN (FORMAT JSON) ${query}`)
      return result[0]["QUERY PLAN"]
    } catch (error) {
      logger.error(`Failed to get query plan for: ${query}`, error)
      throw error
    }
  }

  // Analyze a query
  async analyzeQuery(query: string): Promise<any> {
    try {
      const result = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)
      return result[0]["QUERY PLAN"]
    } catch (error) {
      logger.error(`Failed to analyze query: ${query}`, error)
      throw error
    }
  }

  // Get table statistics
  async getTableStatistics(tableName: string): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          reltuples::bigint AS approximate_row_count,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
          pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
          pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size,
          (SELECT COUNT(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
        AND n.nspname = 'public'
        AND c.relname = ${tableName}
      `
      return result[0]
    } catch (error) {
      logger.error(`Failed to get table statistics for: ${tableName}`, error)
      throw error
    }
  }

  // Get index usage statistics
  async getIndexUsageStatistics(tableName: string): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT
          indexrelname AS index_name,
          idx_scan AS index_scans,
          idx_tup_read AS tuples_read,
          idx_tup_fetch AS tuples_fetched,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND relname = ${tableName}
        ORDER BY idx_scan DESC
      `
      return result
    } catch (error) {
      logger.error(`Failed to get index usage statistics for: ${tableName}`, error)
      throw error
    }
  }

  // Get unused indexes
  async getUnusedIndexes(): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT
          schemaname || '.' || relname AS table,
          indexrelname AS index,
          pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
          idx_scan as index_scans
        FROM pg_stat_user_indexes ui
        JOIN pg_index i ON ui.indexrelid = i.indexrelid
        WHERE NOT indisunique AND idx_scan < 50
        AND pg_relation_size(i.indexrelid) > 5 * 8192
        ORDER BY pg_relation_size(i.indexrelid) DESC
      `
      return result
    } catch (error) {
      logger.error("Failed to get unused indexes", error)
      throw error
    }
  }

  // Get duplicate indexes
  async getDuplicateIndexes(): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT
          indrelid::regclass AS table_name,
          array_agg(indexrelid::regclass) AS indexes,
          array_agg(indisunique) AS unique_indexes,
          array_agg(indpred IS NOT NULL) AS has_predicate,
          array_agg(pg_get_indexdef(indexrelid)) AS definitions
        FROM pg_index
        GROUP BY indrelid, indkey
        HAVING COUNT(*) > 1
        ORDER BY indrelid
      `
      return result
    } catch (error) {
      logger.error("Failed to get duplicate indexes", error)
      throw error
    }
  }

  // Get slow queries from pg_stat_statements
  async getSlowQueries(limit = 10): Promise<any> {
    try {
      // Check if pg_stat_statements extension is available
      const extensionExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )
      `

      if (!extensionExists[0].exists) {
        throw new Error("pg_stat_statements extension is not installed")
      }

      const result = await prisma.$queryRaw`
        SELECT
          query,
          calls,
          total_time / calls AS avg_time,
          min_time,
          max_time,
          stddev_time,
          rows / calls AS avg_rows
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY total_time / calls DESC
        LIMIT ${limit}
      `
      return result
    } catch (error) {
      logger.error("Failed to get slow queries", error)
      throw error
    }
  }

  // Suggest indexes based on query patterns
  async suggestIndexes(): Promise<any> {
    try {
      // Check if pg_stat_statements extension is available
      const extensionExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )
      `

      if (!extensionExists[0].exists) {
        throw new Error("pg_stat_statements extension is not installed")
      }

      const result = await prisma.$queryRaw`
        SELECT
          schemaname,
          relname,
          seq_scan,
          seq_tup_read,
          idx_scan,
          seq_tup_read / seq_scan AS avg_seq_tuples,
          idx_scan / seq_scan AS scan_ratio
        FROM pg_stat_user_tables
        WHERE seq_scan > 0
        AND seq_tup_read / seq_scan > 1000
        AND idx_scan / seq_scan < 0.1
        ORDER BY seq_tup_read DESC
        LIMIT 10
      `
      return result
    } catch (error) {
      logger.error("Failed to suggest indexes", error)
      throw error
    }
  }

  // Vacuum analyze a table
  async vacuumAnalyzeTable(tableName: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`VACUUM ANALYZE "${tableName}"`)
      logger.info(`Vacuum analyze completed for table: ${tableName}`)
    } catch (error) {
      logger.error(`Failed to vacuum analyze table: ${tableName}`, error)
      throw error
    }
  }

  // Reindex a table
  async reindexTable(tableName: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`REINDEX TABLE "${tableName}"`)
      logger.info(`Reindex completed for table: ${tableName}`)
    } catch (error) {
      logger.error(`Failed to reindex table: ${tableName}`, error)
      throw error
    }
  }
}

// Create and export a default instance
export const queryOptimizer = new QueryOptimizer()

export default {
  QueryOptimizer,
  queryOptimizer,
}
