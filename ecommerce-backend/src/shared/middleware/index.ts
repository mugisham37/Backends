/**
 * Middleware exports
 * Centralized export of all middleware components
 */

// Authentication & Authorization
export * from "./auth.middleware.js";
export * from "./rbac.middleware.js";

// Security
export * from "./security.middleware.js";
export * from "./rate-limit.middleware.js";

// Request handling
export * from "./request-id.middleware.js";
export * from "./request-logging.middleware.js";
export * from "./api-version.middleware.js";

// Re-export commonly used middleware instances
export { securityMiddleware, securityConfigs } from "./security.middleware.js";
export {
  getRateLimitMiddleware,
  rateLimitConfigs,
  bruteForceConfigs,
} from "./rate-limit.middleware.js";
