/**
 * Database Module Index
 * Exports all database-related functionality including optimization and monitoring
 */

// Core database functionality
export {
  getDatabase,
  initializeDatabase,
  closeDatabase,
} from "./connection.js";
export * from "./schema/index.js";

// Database optimization
export {
  databaseOptimizer,
  DatabaseOptimizer,
  OptimizedQueryBuilder,
  type QueryPerformanceMetrics,
  type IndexRecommendation,
} from "./optimization.js";

// Performance monitoring
export {
  dbPerformanceMonitor,
  DatabasePerformanceMonitor,
  type DatabasePerformanceMetrics,
  type PerformanceAlert,
} from "./performance-monitor.js";

// Optimized repositories
export {
  OptimizedBaseRepository,
  type PaginationOptions,
  type SortOptions,
  type FilterOptions,
  type QueryOptions,
  type PaginatedResult,
} from "../repositories/optimized-base.repository.js";

export {
  OptimizedProductRepository,
  type ProductFilters,
  type ProductWithRelations,
  type ProductSearchResult,
} from "../repositories/optimized-product.repository.js";

// Query monitoring decorators
export {
  MonitorQuery,
  MonitorAllQueries,
  MonitorBatchQuery,
  MonitorTransaction,
  QueryMonitorUtils,
  type QueryMonitorOptions,
} from "../decorators/query-monitor.decorator.js";

/**
 * Initialize the complete database system with optimization and monitoring
 */
export async function initializeDatabaseSystem(): Promise<void> {
  try {
    console.log("Initializing database system...");

    // Initialize database connection
    await initializeDatabase();
    console.log("✅ Database connection established");

    // Create optimized indexes
    await databaseOptimizer.createOptimizedIndexes();
    console.log("✅ Database indexes optimized");

    // Optimize database configuration
    await databaseOptimizer.optimizeConfiguration();
    console.log("✅ Database configuration optimized");

    // Start performance monitoring
    dbPerformanceMonitor.startMonitoring(60000); // Monitor every minute
    console.log("✅ Database performance monitoring started");

    console.log("🚀 Database system initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database system:", error);
    throw error;
  }
}

/**
 * Shutdown the database system gracefully
 */
export async function shutdownDatabaseSystem(): Promise<void> {
  try {
    console.log("Shutting down database system...");

    // Stop performance monitoring
    dbPerformanceMonitor.stopMonitoring();
    console.log("✅ Database performance monitoring stopped");

    // Close database connection
    await closeDatabase();
    console.log("✅ Database connection closed");

    console.log("🔒 Database system shutdown completed");
  } catch (error) {
    console.error("❌ Error during database system shutdown:", error);
    throw error;
  }
}

/**
 * Get database system health status
 */
export function getDatabaseSystemHealth() {
  const performanceHealth = dbPerformanceMonitor.getHealthStatus();
  const queryMetrics = databaseOptimizer.getPerformanceSummary();

  return {
    performance: performanceHealth,
    queries: queryMetrics,
    timestamp: new Date(),
  };
}

/**
 * Get comprehensive database system report
 */
export function getDatabaseSystemReport(hours: number = 24) {
  const performanceReport = dbPerformanceMonitor.generateReport(hours);
  const slowQueries = databaseOptimizer.getSlowQueryRecommendations();

  return {
    performance: performanceReport,
    slowQueries,
    timestamp: new Date(),
  };
}
