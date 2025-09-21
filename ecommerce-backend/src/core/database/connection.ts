/**
 * Database Connection
 * Handles PostgreSQL connection using Drizzle ORM
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../../shared/config/env.config.js";

// Create the connection
const connectionString = config.database.url;
const client = postgres(connectionString, {
  max: config.database.maxConnections,
});

// Create the database instance
export const db = drizzle(client);

// Export the database type for use in repositories
export type Database = typeof db;
export type DrizzleDB = typeof db;

// Export connection utilities
export { client as postgresClient };

// Get database instance function
export function getDatabase(): Database {
  return db;
}

// Initialize database function
export async function initializeDatabase(): Promise<Database> {
  // Test the connection
  try {
    await client`SELECT 1`;
    console.log("Database connection initialized successfully");
    return db;
  } catch (error) {
    console.error("Failed to initialize database connection:", error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await client.end();
}
