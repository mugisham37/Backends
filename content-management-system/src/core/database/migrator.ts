import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDatabase, getConnectionPool } from "./connection.js";
import { dbLogger } from "../../utils/logger.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration configuration
 */
interface MigrationConfig {
  migrationsFolder?: string;
  migrationsTable?: string;
}

/**
 * Migration result
 */
interface MigrationResult {
  success: boolean;
  appliedMigrations?: string[];
  error?: string;
}

/**
 * Run database migrations
 */
export const runMigrations = async (
  config?: MigrationConfig
): Promise<MigrationResult> => {
  try {
    const migrationsFolder =
      config?.migrationsFolder || path.join(__dirname, "migrations");

    dbLogger.info("Starting database migrations...", {
      migrationsFolder,
      migrationsTable: config?.migrationsTable || "__drizzle_migrations",
    });

    const db = getDatabase();

    // Run migrations
    const migrationResult = await migrate(db, {
      migrationsFolder,
      migrationsTable: config?.migrationsTable,
    });

    dbLogger.info("Database migrations completed successfully");

    return {
      success: true,
      appliedMigrations: [], // Drizzle doesn't return applied migrations list
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown migration error";
    dbLogger.error("Database migration failed:", error);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Check migration status
 */
export const checkMigrationStatus = async (): Promise<{
  pending: boolean;
  appliedCount: number;
  error?: string;
}> => {
  try {
    const connectionPool = getConnectionPool();

    // Check if migrations table exists
    const migrationTableExists = await connectionPool`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      ) as exists
    `;

    if (!migrationTableExists[0]?.exists) {
      return {
        pending: true,
        appliedCount: 0,
      };
    }

    // Get applied migrations count
    const appliedMigrations = await connectionPool`
      SELECT COUNT(*) as count FROM __drizzle_migrations
    `;

    const appliedCount = Number(appliedMigrations[0]?.count || 0);

    dbLogger.info(`Found ${appliedCount} applied migrations`);

    return {
      pending: false, // We can't easily check for pending migrations without file system access
      appliedCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    dbLogger.error("Failed to check migration status:", error);

    return {
      pending: false,
      appliedCount: 0,
      error: errorMessage,
    };
  }
};

/**
 * Reset database (drop all tables and re-run migrations)
 * WARNING: This will delete all data!
 */
export const resetDatabase = async (): Promise<MigrationResult> => {
  try {
    dbLogger.warn("Resetting database - this will delete all data!");

    const connectionPool = getConnectionPool();

    // Drop all tables in the public schema
    await connectionPool`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `;

    dbLogger.info("Database schema reset completed");

    // Run migrations
    return await runMigrations();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown reset error";
    dbLogger.error("Database reset failed:", error);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Validate database schema
 */
export const validateSchema = async (): Promise<{
  valid: boolean;
  missingTables?: string[];
  error?: string;
}> => {
  try {
    const connectionPool = getConnectionPool();

    // Expected tables from our schema
    const expectedTables = [
      "tenants",
      "users",
      "user_sessions",
      "user_permissions",
      "contents",
      "content_versions",
      "content_categories",
      "content_tags",
      "media",
      "media_folders",
      "media_transformations",
      "media_usage",
    ];

    // Get existing tables
    const existingTables = await connectionPool`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `;

    const existingTableNames = existingTables.map((row) => row.table_name);
    const missingTables = expectedTables.filter(
      (table) => !existingTableNames.includes(table)
    );

    if (missingTables.length > 0) {
      dbLogger.warn("Missing database tables:", missingTables);
      return {
        valid: false,
        missingTables,
      };
    }

    dbLogger.info("Database schema validation passed");
    return { valid: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown validation error";
    dbLogger.error("Schema validation failed:", error);

    return {
      valid: false,
      error: errorMessage,
    };
  }
};

/**
 * Auto-migrate on application startup
 */
export const autoMigrate = async (): Promise<void> => {
  try {
    dbLogger.info("Checking for pending migrations...");

    const status = await checkMigrationStatus();

    if (status.error) {
      throw new Error(`Migration status check failed: ${status.error}`);
    }

    // Always run migrations to ensure we're up to date
    const result = await runMigrations();

    if (!result.success) {
      throw new Error(`Auto-migration failed: ${result.error}`);
    }

    // Validate schema after migration
    const validation = await validateSchema();

    if (!validation.valid) {
      const errorMsg =
        validation.error ||
        `Missing tables: ${validation.missingTables?.join(", ")}`;
      throw new Error(`Schema validation failed: ${errorMsg}`);
    }

    dbLogger.info("Auto-migration completed successfully");
  } catch (error) {
    dbLogger.error("Auto-migration failed:", error);
    throw error;
  }
};
