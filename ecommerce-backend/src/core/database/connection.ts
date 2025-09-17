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

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await client.end();
}
