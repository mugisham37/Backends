import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../../config/index.js";
import { dbLogger } from "../../utils/logger.js";

// PostgreSQL connection with connection pooling
let connectionPool: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Create PostgreSQL connection pool with optimized settings
 */
const createConnectionPool = (): postgres.Sql => {
  const connectionString = config.database.url;

  dbLogger.info("Creating PostgreSQL connection pool...", {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    maxConnections: config.database.maxConnections,
  });

  return postgres(connectionString, {
    max: config.database.maxConnections,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Disable prepared statements for better compatibility
    onnotice: config.isDevelopment ? console.log : undefined,
    debug: config.isDevelopment,
  });
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
    await connectionPool`SELECT 1 as test`;

    // Initialize Drizzle ORM
    db = drizzle(connectionPool, {
      logger: config.isDevelopment,
    });

    dbLogger.info("Database connection initialized successfully");
  } catch (error) {
    dbLogger.error("Failed to initialize database connection:", error);
    throw new Error(
      `Database initialization failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
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
      await connectionPool.end();
      connectionPool = null;
      db = null;
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

    return { healthy: true, latency };
  } catch (error) {
    dbLogger.error("Database health check failed:", error);
    return { healthy: false };
  }
};

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  dbLogger.info(`Received ${signal}, closing database connection...`);
  try {
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    dbLogger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  dbLogger.error("Uncaught exception:", error);
  await closeDatabase();
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  dbLogger.error("Unhandled rejection:", reason);
  await closeDatabase();
  process.exit(1);
});
