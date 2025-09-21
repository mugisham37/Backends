#!/usr/bin/env tsx

/**
 * Configuration check script
 * Validates that all configuration files are properly set up
 */

import fs from "node:fs";
import path from "node:path";
import { getConfigSummary } from "../src/shared/config/env.config";

console.log("🔧 Checking configuration files and settings...\n");

const requiredFiles = [
  "package.json",
  "tsconfig.json",
  "drizzle.config.ts",
  "biome.json",
  "src/server.ts",
  "src/app.ts",
  "src/shared/config/env.config.ts",
  "src/shared/config/security.config.ts",
];

const optionalFiles = [
  ".env.development",
  ".env.production",
  "docker-compose.yml",
  "Dockerfile",
  "ecosystem.config.js",
];

console.log("📁 Checking required files:");
const missingFiles: string[] = [];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  console.log(`  ${exists ? "✅" : "❌"} ${file}`);
  if (!exists) {
    missingFiles.push(file);
  }
}

console.log("\n📁 Checking optional files:");
for (const file of optionalFiles) {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  console.log(
    `  ${exists ? "✅" : "⚠️ "} ${file} ${exists ? "" : "(optional)"}`
  );
}

console.log("\n⚙️  Configuration Summary:");
const summary = getConfigSummary();
console.log(`  Environment: ${summary.environment}`);
console.log(`  Port: ${summary.port}`);
console.log(
  `  Database: ${summary.database.host}:${summary.database.port}/${summary.database.name}`
);
console.log(`  SSL: ${summary.database.ssl ? "enabled" : "disabled"}`);
console.log(`  Redis: ${summary.redis.enabled ? "enabled" : "disabled"}`);
console.log(`  Log Level: ${summary.monitoring.logLevel}`);

console.log("\n🚀 Feature Flags:");
for (const [key, value] of Object.entries(summary.features)) {
  console.log(`  ${value ? "✅" : "❌"} ${key}: ${value}`);
}

if (missingFiles.length > 0) {
  console.log("\n❌ Missing required files:");
  for (const file of missingFiles) {
    console.log(`   • ${file}`);
  }
  process.exit(1);
}

console.log("\n✅ Configuration check passed successfully!");
