#!/usr/bin/env tsx

/**
 * Database migration script
 * Runs Drizzle migrations against the configured database
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../src/shared/config/env.config";

async function runMigrations() {
  console.log("🔄 Running database migrations...");
  console.log(
    `📍 Database: ${config.database.url.replace(/\/\/.*@/, "//***@")}`
  );

  let connection: postgres.Sql | null = null;

  try {
    // Create connection with migration-specific settings
    connection = postgres(config.database.url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 60,
    });

    const db = drizzle(connection);

    // Test connection first
    console.log("🔍 Testing database connection...");
    await connection`SELECT 1`;
    console.log("✅ Database connection successful");

    // Run migrations
    console.log("📦 Applying migrations...");
    await migrate(db, {
      migrationsFolder: "./src/core/database/migrations",
      migrationsTable: "drizzle_migrations",
    });

    console.log("✅ All migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    } else {
      console.error("   Unknown error:", error);
    }

    process.exit(1);
  } finally {
    if (connection) {
      console.log("🔌 Closing database connection...");
      await connection.end();
    }
  }
}

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Migration interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Migration terminated");
  process.exit(1);
});

runMigrations();
