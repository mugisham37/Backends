#!/usr/bin/env tsx

import {
  initializeDatabase,
  closeDatabase,
} from "../src/core/database/connection.js";
import {
  runMigrations,
  resetDatabase,
  checkMigrationStatus,
  validateSchema,
} from "../src/core/database/migrator.js";
import { dbLogger } from "../src/utils/logger.js";

/**
 * Migration CLI commands
 */
const commands = {
  up: "Run pending migrations",
  status: "Check migration status",
  reset: "Reset database (WARNING: deletes all data)",
  validate: "Validate database schema",
} as const;

type Command = keyof typeof commands;

/**
 * Display help information
 */
const showHelp = () => {
  console.log("\n🗄️  Database Migration CLI\n");
  console.log("Usage: npm run migrate <command>\n");
  console.log("Commands:");

  Object.entries(commands).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  });

  console.log("\nExamples:");
  console.log("  npm run migrate up       # Run migrations");
  console.log("  npm run migrate status   # Check status");
  console.log("  npm run migrate validate # Validate schema");
  console.log("");
};

/**
 * Run migration command
 */
const runCommand = async (command: Command) => {
  try {
    // Initialize database connection
    await initializeDatabase();

    switch (command) {
      case "up":
        console.log("🚀 Running database migrations...");
        const migrationResult = await runMigrations();

        if (migrationResult.success) {
          console.log("✅ Migrations completed successfully");
        } else {
          console.error("❌ Migration failed:", migrationResult.error);
          process.exit(1);
        }
        break;

      case "status":
        console.log("📊 Checking migration status...");
        const status = await checkMigrationStatus();

        if (status.error) {
          console.error("❌ Status check failed:", status.error);
          process.exit(1);
        }

        console.log(`📈 Applied migrations: ${status.appliedCount}`);
        console.log(
          `⏳ Pending migrations: ${status.pending ? "Yes" : "Unknown"}`
        );
        break;

      case "reset":
        console.log("⚠️  WARNING: This will delete ALL data!");
        console.log("🔄 Resetting database...");

        const resetResult = await resetDatabase();

        if (resetResult.success) {
          console.log("✅ Database reset completed successfully");
        } else {
          console.error("❌ Database reset failed:", resetResult.error);
          process.exit(1);
        }
        break;

      case "validate":
        console.log("🔍 Validating database schema...");
        const validation = await validateSchema();

        if (validation.valid) {
          console.log("✅ Database schema is valid");
        } else {
          console.error("❌ Schema validation failed");
          if (validation.missingTables?.length) {
            console.error(
              "Missing tables:",
              validation.missingTables.join(", ")
            );
          }
          if (validation.error) {
            console.error("Error:", validation.error);
          }
          process.exit(1);
        }
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Command failed:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await closeDatabase();
  }
};

/**
 * Main CLI entry point
 */
const main = async () => {
  const command = process.argv[2] as Command;

  if (!command) {
    showHelp();
    return;
  }

  if (!Object.keys(commands).includes(command)) {
    console.error(`❌ Invalid command: ${command}`);
    showHelp();
    process.exit(1);
  }

  await runCommand(command);
};

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  dbLogger.error("Uncaught exception in migration CLI:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  dbLogger.error("Unhandled rejection in migration CLI:", reason);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  console.error("❌ CLI failed:", error);
  process.exit(1);
});
