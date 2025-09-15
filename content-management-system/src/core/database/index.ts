// Main database module - exports everything needed for database operations
export * from "./connection.js";
export * from "./migrator.js";
export * from "./schema/index.js";

// Re-export commonly used functions with better names
export {
  initializeDatabase as connectToDatabase,
  closeDatabase as disconnectFromDatabase,
  getDatabase as db,
} from "./connection.js";

export {
  autoMigrate,
  runMigrations,
  checkMigrationStatus,
  validateSchema,
} from "./migrator.js";
