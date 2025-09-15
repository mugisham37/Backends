import { initializeDatabase, closeDatabase } from "./connection.js";
import { autoMigrate } from "./migrator.js";
import { dbLogger } from "../../utils/logger.js";

/**
 * Database setup options
 */
interface DatabaseSetupOptions {
  runMigrations?: boolean;
  validateSchema?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Setup database with connection, migrations, and validation
 */
export const setupDatabase = async (
  options: DatabaseSetupOptions = {}
): Promise<void> => {
  const {
    runMigrations = true,
    validateSchema = true,
    retryAttempts = 3,
    retryDelay = 2000,
  } = options;

  let attempt = 0;

  while (attempt < retryAttempts) {
    try {
      attempt++;

      dbLogger.info(
        `Setting up database (attempt ${attempt}/${retryAttempts})...`
      );

      // Initialize database connection
      await initializeDatabase();
      dbLogger.info("✅ Database connection established");

      // Run migrations if requested
      if (runMigrations) {
        await autoMigrate();
        dbLogger.info("✅ Database migrations completed");
      }

      dbLogger.info("🎉 Database setup completed successfully");
      return;
    } catch (error) {
      dbLogger.error(`Database setup attempt ${attempt} failed:`, error);

      if (attempt >= retryAttempts) {
        dbLogger.error("❌ Database setup failed after all retry attempts");
        throw new Error(
          `Database setup failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      dbLogger.info(`Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
};

/**
 * Graceful database shutdown
 */
export const shutdownDatabase = async (): Promise<void> => {
  try {
    dbLogger.info("Shutting down database connection...");
    await closeDatabase();
    dbLogger.info("✅ Database shutdown completed");
  } catch (error) {
    dbLogger.error("❌ Database shutdown failed:", error);
    throw error;
  }
};

/**
 * Database health check
 */
export const healthCheck = async (): Promise<{
  healthy: boolean;
  details: {
    connection: boolean;
    latency?: number;
    error?: string;
  };
}> => {
  try {
    const { checkDatabaseHealth } = await import("./connection.js");
    const health = await checkDatabaseHealth();

    return {
      healthy: health.healthy,
      details: {
        connection: health.healthy,
        latency: health.latency,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      healthy: false,
      details: {
        connection: false,
        error: errorMessage,
      },
    };
  }
};
