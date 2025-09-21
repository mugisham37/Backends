#!/usr/bin/env tsx

/**
 * Environment valida  if (config.isProduction && config.monitoring.logLevel === 'debug') {
    console.log('⚠️  Warning: LOG_LEVEL is set to debug in production');
  }n script
 * Validates that all required environment variables are set and valid
 */

import { config } from "../src/shared/config/env.config";

console.log("🔍 Validating environment configuration...\n");

try {
  // Test database connection
  console.log("✅ Environment variables loaded successfully");
  console.log(`📦 NODE_ENV: ${config.nodeEnv}`);
  console.log(`🚀 PORT: ${config.port}`);
  console.log(
    `🗄️  Database URL: ${config.database.url.replace(/\/\/.*@/, "//***:***@")}`
  );
  console.log(
    `🔐 JWT Access Secret: ${config.jwt.accessSecret ? "***" : "NOT SET"}`
  );

  if (config.redis?.uri) {
    console.log(
      `💾 Redis URI: ${config.redis.uri.replace(/\/\/.*@/, "//***:***@")}`
    );
  }

  // Validate critical settings
  const errors: string[] = [];

  if (!config.jwt.accessSecret || config.jwt.accessSecret.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters long");
  }

  if (!config.database.url) {
    errors.push("DATABASE_URL is required");
  }

  if (
    config.isProduction &&
    Array.isArray(config.cors.origin) &&
    config.cors.origin.some((origin) => origin.includes("localhost"))
  ) {
    errors.push("CORS_ORIGIN should not include localhost in production");
  }

  if (config.isProduction && config.monitoring.logLevel === "debug") {
    console.log("⚠️  Warning: LOG_LEVEL is set to debug in production");
  }

  if (errors.length > 0) {
    console.log("\n❌ Environment validation failed:");
    for (const error of errors) {
      console.log(`   • ${error}`);
    }
    process.exit(1);
  }

  console.log("\n✅ Environment validation passed successfully!");
} catch (error) {
  console.error("❌ Environment validation failed:", error);
  process.exit(1);
}
