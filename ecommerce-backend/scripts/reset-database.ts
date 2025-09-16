#!/usr/bin/env tsx

/**
 * Database reset script
 * Drops all tables and recreates them with fresh migrations and seed data
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { config } from "../src/shared/config/env.config";

async function resetDatabase() {
  console.log("🔄 Resetting database...");
  console.log(
    `📍 Database: ${config.database.url.replace(/\/\/.*@/, "//***@")}`
  );

  // Confirm in production
  if (config.nodeEnv === "production") {
    console.error("❌ Cannot reset database in production environment!");
    process.exit(1);
  }

  let connection: postgres.Sql | null = null;

  try {
    connection = postgres(config.database.url, { max: 1 });
    const db = drizzle(connection);

    console.log("🔍 Testing database connection...");
    await connection`SELECT 1`;
    console.log("✅ Database connection successful");

    console.log("🗑️  Dropping all tables...");

    // Drop tables in reverse dependency order
    const dropQueries = [
      sql`DROP TABLE IF EXISTS "payments" CASCADE`,
      sql`DROP TABLE IF EXISTS "order_items" CASCADE`,
      sql`DROP TABLE IF EXISTS "orders" CASCADE`,
      sql`DROP TABLE IF EXISTS "product_variants" CASCADE`,
      sql`DROP TABLE IF EXISTS "products" CASCADE`,
      sql`DROP TABLE IF EXISTS "categories" CASCADE`,
      sql`DROP TABLE IF EXISTS "vendors" CASCADE`,
      sql`DROP TABLE IF EXISTS "users" CASCADE`,
      sql`DROP TABLE IF EXISTS "drizzle_migrations" CASCADE`,
    ];

    for (const query of dropQueries) {
      await db.execute(query);
    }

    // Drop enums
    const dropEnums = [
      sql`DROP TYPE IF EXISTS "user_role" CASCADE`,
      sql`DROP TYPE IF EXISTS "user_status" CASCADE`,
      sql`DROP TYPE IF EXISTS "vendor_status" CASCADE`,
      sql`DROP TYPE IF EXISTS "verification_status" CASCADE`,
      sql`DROP TYPE IF EXISTS "product_condition" CASCADE`,
      sql`DROP TYPE IF EXISTS "product_status" CASCADE`,
      sql`DROP TYPE IF EXISTS "order_status" CASCADE`,
      sql`DROP TYPE IF EXISTS "payment_status" CASCADE`,
      sql`DROP TYPE IF EXISTS "shipping_status" CASCADE`,
    ];

    for (const query of dropEnums) {
      await db.execute(query);
    }

    console.log("✅ All tables and types dropped");
  } catch (error) {
    console.error("❌ Database reset failed:");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
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

  console.log("✅ Database reset completed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Run migrations: npm run db:migrate");
  console.log("   2. Seed data: npm run db:seed");
}

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Reset interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Reset terminated");
  process.exit(1);
});

resetDatabase();
