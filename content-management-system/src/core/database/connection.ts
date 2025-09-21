import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../../shared/config/index";
import { dbLogger } from "../../shared/utils/logger";
import { ConnectionPoolOptimizer, QueryOptimizer } from "./query-optimizer";

// Export the DrizzleDatabase type for other modules
export type DrizzleDatabase = PostgresJsDatabase<Record<string, never>>;

// PostgreSQL connection with connection pooling
let connectionPool: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let queryOptimizer: QueryOptimizer | null = null;
let poolOptimizer: ConnectionPoolOptimizer | null = null;

// Connection metrics
const connectionMetrics = {
  totalQueries: 0,
  totalTime: 0,
  errors: 0,
  lastHealthCheck: new Date(),
};

/**
 * Get expected load based on environment
 */
const getExpectedLoad = (): "low" | "medium" | "high" => {
  const env = process.env["NODE_ENV"];
  if (env === "production") return "high";
  if (env === "staging") return "medium";
  return "low";
};

/**
 * Create PostgreSQL connection pool with optimized settings
 */
const createConnectionPool = (): postgres.Sql => {
  const connectionString = config.database.url;

  // Get optimal pool settings
  poolOptimizer = ConnectionPoolOptimizer.getInstance();
  const expectedLoad = getExpectedLoad();
  const poolSettings = poolOptimizer.getOptimalPoolSettings(expectedLoad);

  dbLogger.info("Creating PostgreSQL connection pool...", {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    maxConnections: poolSettings.max,
    expectedLoad,
  });

  const options: postgres.Options<{}> = {
    max: poolSettings.max,
    idle_timeout: Number(poolSettings.idleTimeoutMillis) / 1000, // Convert to seconds
    connect_timeout: Number(poolSettings.acquireTimeoutMillis) / 1000, // Convert to seconds
    max_lifetime: 60 * 60, // 1 hour connection lifetime
    prepare: false, // Disable prepared statements for better compatibility
    debug: config.isDevelopment,
    transform: {
      undefined: null, // Transform undefined to null for PostgreSQL
    },
    connection: {
      application_name: "senior-cms-app",
      statement_timeout: 30000, // 30 seconds in milliseconds
      idle_in_transaction_session_timeout: 60000, // 1 minute in milliseconds
    },
  };

  // Only add onnotice if in development mode
  if (config.isDevelopment) {
    options.onnotice = (notice) => console.log(notice);
  }

  return postgres(connectionString, options);
};

/**
 * Initialize database connection and Drizzle ORM instance
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (connectionPool && db) {
      dbLogger.warn("Database already initialized");
      return;
    }

    dbLogger.info("Initializing database connection...");

    // Create connection pool
    connectionPool = createConnectionPool();

    // Test connection
    const startTime = Date.now();
    await connectionPool`SELECT 1 as test`;
    const connectionTime = Date.now() - startTime;

    dbLogger.info(`Database connection test successful (${connectionTime}ms)`);

    // Initialize Drizzle ORM with custom logger
    db = drizzle(connectionPool, {
      logger: {
        logQuery: (query, params) => {
          connectionMetrics.totalQueries++;
          const startTime = Date.now();

          // Log slow queries
          setTimeout(() => {
            const duration = Date.now() - startTime;
            connectionMetrics.totalTime += duration;

            if (duration > 1000) {
              dbLogger.warn(`Slow query detected (${duration}ms):`, {
                query,
                params,
              });
            }
          }, 0);

          if (config.isDevelopment) {
            dbLogger.debug("Executing query:", { query, params });
          }
        },
      },
    });

    // Initialize query optimizer
    queryOptimizer = new QueryOptimizer(db);

    // Setup connection monitoring
    setupConnectionMonitoring();

    // Warm up cache with frequently accessed data
    await optimizeQueries();

    dbLogger.info(
      "Database connection initialized successfully with optimizations"
    );
  } catch (error) {
    dbLogger.error("Failed to initialize database connection:", error);
    connectionMetrics.errors++;
    throw new Error(
      `Database initialization failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Setup connection monitoring
 */
const setupConnectionMonitoring = (): void => {
  // Monitor connection health every 5 minutes
  setInterval(async () => {
    try {
      const healthResult = await checkDatabaseHealth();
      if (!healthResult.healthy) {
        dbLogger.error("Database health check failed");
        connectionMetrics.errors++;
      }
      connectionMetrics.lastHealthCheck = new Date();
    } catch (error) {
      dbLogger.error("Error during health check:", error);
      connectionMetrics.errors++;
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Log connection metrics every hour
  setInterval(() => {
    logConnectionMetrics();
  }, 60 * 60 * 1000); // 1 hour
};

/**
 * Log connection metrics
 */
const logConnectionMetrics = (): void => {
  const avgQueryTime =
    connectionMetrics.totalQueries > 0
      ? connectionMetrics.totalTime / connectionMetrics.totalQueries
      : 0;

  dbLogger.info("Database connection metrics:", {
    totalQueries: connectionMetrics.totalQueries,
    avgQueryTime: `${avgQueryTime.toFixed(2)}ms`,
    errors: connectionMetrics.errors,
    lastHealthCheck: connectionMetrics.lastHealthCheck,
  });
};

/**
 * Optimize queries and warm up cache
 */
const optimizeQueries = async (): Promise<void> => {
  if (!queryOptimizer || !db) return;

  try {
    // Warm up cache with frequently accessed data
    await queryOptimizer.warmupCache([
      {
        key: "active_tenants",
        queryFn: async () => {
          if (!db) throw new Error("Database not initialized");
          return await db.execute(sql`
            SELECT id, name, slug, is_active 
            FROM tenants 
            WHERE is_active = true 
            ORDER BY created_at DESC
            LIMIT 10
          `);
        },
        ttl: 600, // 10 minutes
      },
      {
        key: "user_roles",
        queryFn: async () => {
          if (!db) throw new Error("Database not initialized");
          return await db.execute(sql`
            SELECT DISTINCT role 
            FROM users 
            WHERE is_active = true
            LIMIT 20
          `);
        },
        ttl: 1800, // 30 minutes
      },
    ]);

    dbLogger.info("Query optimization and cache warmup completed");
  } catch (error) {
    // Log the warmup error but don't fail the entire initialization
    dbLogger.warn("Query optimization warmup failed (this is non-critical):", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // If the error is due to missing tables/columns, we should still continue
    // This allows the app to start even if cache warmup fails
    if (
      error instanceof Error &&
      (error.message.includes("relation") ||
        error.message.includes("column") ||
        error.message.includes("does not exist"))
    ) {
      dbLogger.info(
        "Skipping cache warmup due to schema mismatch - this is expected for new installations"
      );
    }
  }
};

/**
 * Get the Drizzle database instance
 */
export const getDatabase = () => {
  if (!db) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first."
    );
  }
  return db;
};

/**
 * Get the query optimizer instance
 */
export const getQueryOptimizer = (): QueryOptimizer => {
  if (!queryOptimizer) {
    throw new Error(
      "Query optimizer not initialized. Call initializeDatabase() first."
    );
  }
  return queryOptimizer;
};

/**
 * Export the db instance directly for injection
 * This allows the db instance to be injected into services
 */
export { db };

/**
 * Get the raw PostgreSQL connection pool
 */
export const getConnectionPool = () => {
  if (!connectionPool) {
    throw new Error(
      "Connection pool not initialized. Call initializeDatabase() first."
    );
  }
  return connectionPool;
};

/**
 * Close database connection and cleanup resources
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    if (connectionPool) {
      dbLogger.info("Closing database connection...");

      // Clear query optimizer caches
      if (queryOptimizer) {
        await queryOptimizer.clearCaches();
        queryOptimizer = null;
      }

      // Close connection pool
      await connectionPool.end();
      connectionPool = null;
      db = null;
      poolOptimizer = null;

      // Log final metrics
      logConnectionMetrics();

      dbLogger.info("Database connection closed successfully");
    }
  } catch (error) {
    dbLogger.error("Error closing database connection:", error);
    throw error;
  }
};

/**
 * Check if database is connected
 */
export const isDatabaseConnected = (): boolean => {
  return connectionPool !== null && db !== null;
};

/**
 * Health check for database connection
 */
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  latency?: number;
}> => {
  try {
    if (!connectionPool) {
      return { healthy: false };
    }

    const start = Date.now();
    await connectionPool`SELECT 1 as health_check`;
    const latency = Date.now() - start;

    // Log if health check is slow
    if (latency > 1000) {
      dbLogger.warn(`Slow health check: ${latency}ms`);
    }

    return { healthy: true, latency };
  } catch (error) {
    dbLogger.error("Database health check failed:", error);
    connectionMetrics.errors++;
    return { healthy: false };
  }
};

/**
 * Get comprehensive connection statistics
 */
export const getConnectionStats = async (): Promise<{
  poolHealth: any;
  queryMetrics: typeof connectionMetrics;
  recommendations: string[];
}> => {
  if (!poolOptimizer || !db) {
    throw new Error("Database not initialized");
  }

  const poolHealth = await poolOptimizer.monitorPool(db);

  return {
    poolHealth,
    queryMetrics: connectionMetrics,
    recommendations: poolHealth.recommendations,
  };
};

/**
 * Execute optimized query with caching
 */
export const executeOptimizedQuery = async <T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> => {
  if (!queryOptimizer) {
    throw new Error("Query optimizer not initialized");
  }

  return queryOptimizer.executeWithCache(queryKey, queryFn, ttlSeconds);
};

/**
 * Execute batch query to prevent N+1 problems
 */
export const executeBatchQuery = async <T, K>(
  batchKey: string,
  ids: K[],
  queryFn: (ids: K[]) => Promise<T[]>,
  keyExtractor: (item: T) => K,
  ttlSeconds?: number
): Promise<Map<K, T>> => {
  if (!queryOptimizer) {
    throw new Error("Query optimizer not initialized");
  }

  return queryOptimizer.batchQuery(
    batchKey,
    ids,
    queryFn,
    keyExtractor,
    ttlSeconds
  );
};

/**
 * Graceful database shutdown (internal use only)
 * This is called by the main application's shutdown handlers
 */
export const gracefulDatabaseShutdown = async (): Promise<void> => {
  dbLogger.info("Gracefully shutting down database connection...");
  try {
    await closeDatabase();
    dbLogger.info("Database shutdown completed successfully");
  } catch (error) {
    dbLogger.error("Error during database shutdown:", error);
    throw error;
  }
};

// NOTE: Process event handlers have been removed from this module
// The main application (server.ts) handles all process events and calls
// gracefulDatabaseShutdown() as needed to avoid conflicts.
