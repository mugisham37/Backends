/**
 * Database schema exports
 * Central export point for all database schemas and types
 */

// Export all tables
export * from "./users";
export * from "./vendors";
export * from "./products";
export * from "./orders";
export * from "./notifications";
export * from "./analytics";
export * from "./webhooks";

// Export relations
export * from "./relations";

// Re-export commonly used types for convenience
// Note: Types are already exported from individual files via export *
