/**
 * Database module exports
 * Central export point for database functionality
 */

// Export connection utilities
export {
  createConnection,
  createDatabase,
  getDatabase,
  closeConnection,
  checkDatabaseHealth,
  type Database,
  type DatabaseConnection,
} from "./connection";

// Export all schemas and types
export * from "./schema/index";

// Export commonly used Drizzle utilities
export {
  eq,
  and,
  or,
  not,
  isNull,
  isNotNull,
  like,
  ilike,
  desc,
  asc,
} from "drizzle-orm";
export { sql } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
