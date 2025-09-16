/**
 * Database connection configuration
 * Sets up PostgreSQL connection with Drizzle ORM and connection pooling
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { config } from "../../shared/config/env.config";
import * as schema from "./schema/index";

// Connection pool configuration
const connectionConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "ecommerce_dev",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  max: config.database.maxConnections,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
};

// Create connection pool
let connection: postgres.Sql | null = null;

export function createConnection(): postgres.Sql {
  if (!connection) {
    // Use DATABASE_URL if available, otherwise use individual config
    const connectionString = config.database.url;

    connection = postgres(connectionString, {
      max: connectionConfig.max,
      idle_timeout: connectionConfig.idle_timeout,
      connect_timeout: connectionConfig.connect_timeout,
      prepare: connectionConfig.prepare,
      onnotice: config.nodeEnv === "development" ? console.log : undefined,
    });
  }

  return connection;
}

// Create Drizzle database instance
export function createDatabase() {
  const connection = createConnection();
  return drizzle(connection, { schema });
}

// Global database instance
let db: ReturnType<typeof createDatabase> | null = null;

export function getDatabase() {
  if (!db) {
    db = createDatabase();
  }
  return db;
}

// Close database connection
export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const database = getDatabase();
    await database.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// Export types
export type Database = ReturnType<typeof getDatabase>;
export type DatabaseConnection = postgres.Sql;
