// Re-export the new Drizzle-based database connection
export {
  initializeDatabase as connectDatabase,
  closeDatabase as disconnectDatabase,
  isDatabaseConnected,
  getDatabase,
  getConnectionPool,
  checkDatabaseHealth,
} from "../core/database/connection.js";

// Graceful shutdown is handled in the core database connection module
