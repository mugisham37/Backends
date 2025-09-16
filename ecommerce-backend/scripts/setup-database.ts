#!/usr/bin/env tsx

/**
 * Database setup script
 * Complete database setup: reset, migrate, and seed
 */

import { execSync } from "child_process";

async function setupDatabase() {
  console.log("🚀 Setting up database from scratch...");

  try {
    console.log("\n1️⃣ Resetting database...");
    execSync("npm run db:reset", { stdio: "inherit" });

    console.log("\n2️⃣ Running migrations...");
    execSync("npm run db:migrate", { stdio: "inherit" });

    console.log("\n3️⃣ Seeding sample data...");
    execSync("npm run db:seed", { stdio: "inherit" });

    console.log("\n🎉 Database setup completed successfully!");
    console.log("\n🔑 You can now login with:");
    console.log("   Admin: admin@ecommerce.dev / admin123");
    console.log("   Vendor: vendor@ecommerce.dev / vendor123");
    console.log("   Customer: customer@ecommerce.dev / customer123");
  } catch (error) {
    console.error("\n❌ Database setup failed:");
    console.error(error);
    process.exit(1);
  }
}

setupDatabase();
