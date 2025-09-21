/**
 * Error type definitions and constants
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication & Authorization
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  INVALID_PHONE: "INVALID_PHONE",
  INVALID_UUID: "INVALID_UUID",

  // Resource Management
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  VENDOR_NOT_FOUND: "VENDOR_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",

  // Conflicts
  CONFLICT: "CONFLICT",
  RESOURCE_EXISTS: "RESOURCE_EXISTS",
  EMAIL_EXISTS: "EMAIL_EXISTS",
  USERNAME_EXISTS: "USERNAME_EXISTS",
  SLUG_EXISTS: "SLUG_EXISTS",
  SKU_EXISTS: "SKU_EXISTS",

  // Business Logic
  BUSINESS_LOGIC_ERROR: "BUSINESS_LOGIC_ERROR",
  INSUFFICIENT_INVENTORY: "INSUFFICIENT_INVENTORY",
  INVALID_ORDER_STATUS: "INVALID_ORDER_STATUS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUND_FAILED: "REFUND_FAILED",
  SHIPPING_ERROR: "SHIPPING_ERROR",
  VENDOR_NOT_APPROVED: "VENDOR_NOT_APPROVED",
  PRODUCT_NOT_AVAILABLE: "PRODUCT_NOT_AVAILABLE",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  API_QUOTA_EXCEEDED: "API_QUOTA_EXCEEDED",

  // File Operations
  FILE_UPLOAD_ERROR: "FILE_UPLOAD_ERROR",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  STORAGE_ERROR: "STORAGE_ERROR",

  // Database
  DATABASE_ERROR: "DATABASE_ERROR",
  CONNECTION_ERROR: "CONNECTION_ERROR",
  QUERY_ERROR: "QUERY_ERROR",
  TRANSACTION_ERROR: "TRANSACTION_ERROR",
  CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION",

  // External Services
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  PAYMENT_GATEWAY_ERROR: "PAYMENT_GATEWAY_ERROR",
  EMAIL_SERVICE_ERROR: "EMAIL_SERVICE_ERROR",
  SMS_SERVICE_ERROR: "SMS_SERVICE_ERROR",
  SHIPPING_SERVICE_ERROR: "SHIPPING_SERVICE_ERROR",

  // System
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",

  // Cache
  CACHE_ERROR: "CACHE_ERROR",
  CACHE_MISS: "CACHE_MISS",
  CACHE_TIMEOUT: "CACHE_TIMEOUT",

  // Generic
  CLIENT_ERROR: "CLIENT_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

// Error Categories for logging and monitoring
export const ERROR_CATEGORIES = {
  AUTHENTICATION: "authentication",
  AUTHORIZATION: "authorization",
  VALIDATION: "validation",
  BUSINESS_LOGIC: "business_logic",
  DATABASE: "database",
  EXTERNAL_SERVICE: "external_service",
  FILE_OPERATION: "file_operation",
  RATE_LIMITING: "rate_limiting",
  SYSTEM: "system",
  NETWORK: "network",
  CACHE: "cache",
  UNKNOWN: "unknown",
} as const;

// Error Severity Levels
export const ERROR_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

// Error context interface
export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  vendorId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// Error log entry interface
export interface ErrorLogEntry {
  level: "error" | "warn" | "info";
  message: string;
  error?: Error;
  code?: string;
  statusCode?: number;
  category?: string;
  severity?: string;
  context?: ErrorContext;
  stack?: string;
  timestamp: Date;
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode?: number;
    details?: any;
    timestamp: string;
    correlationId?: string;
  };
}

// Success response interface
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp?: string;
    correlationId?: string;
  };
}

// API Response type
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Error mapping for common database errors
export const DATABASE_ERROR_MAPPING = {
  "23505": ERROR_CODES.RESOURCE_EXISTS, // Unique constraint violation
  "23503": ERROR_CODES.CONSTRAINT_VIOLATION, // Foreign key constraint violation
  "23502": ERROR_CODES.MISSING_REQUIRED_FIELD, // Not null constraint violation
  "23514": ERROR_CODES.VALIDATION_ERROR, // Check constraint violation
  "42P01": ERROR_CODES.CONFIGURATION_ERROR, // Undefined table
  "42703": ERROR_CODES.CONFIGURATION_ERROR, // Undefined column
  "08006": ERROR_CODES.CONNECTION_ERROR, // Connection failure
  "08003": ERROR_CODES.CONNECTION_ERROR, // Connection does not exist
  "08000": ERROR_CODES.CONNECTION_ERROR, // Connection exception
} as const;

// HTTP method types
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

// Error handler configuration
export interface ErrorHandlerConfig {
  includeStackTrace: boolean;
  logErrors: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  enableCorrelationId: boolean;
  sanitizeErrors: boolean;
  maxErrorDetailsLength: number;
}

// Default error handler configuration
export const DEFAULT_ERROR_CONFIG: ErrorHandlerConfig = {
  includeStackTrace: process.env.NODE_ENV === "development",
  logErrors: true,
  logLevel: "error",
  enableCorrelationId: true,
  sanitizeErrors: process.env.NODE_ENV === "production",
  maxErrorDetailsLength: 1000,
};

// Type guards
export function isAppError(
  error: any
): error is import("./app-error.js").AppError {
  return error && typeof error === "object" && error.isOperational === true;
}

export function isValidationError(error: any): boolean {
  return isAppError(error) && error.code === ERROR_CODES.VALIDATION_ERROR;
}

export function isAuthenticationError(error: any): boolean {
  return isAppError(error) && error.code === ERROR_CODES.AUTHENTICATION_ERROR;
}

export function isAuthorizationError(error: any): boolean {
  return isAppError(error) && error.code === ERROR_CODES.AUTHORIZATION_ERROR;
}

export function isNotFoundError(error: any): boolean {
  return isAppError(error) && error.code === ERROR_CODES.NOT_FOUND;
}

export function isDatabaseError(error: any): boolean {
  return isAppError(error) && error.code === ERROR_CODES.DATABASE_ERROR;
}

export function isExternalServiceError(error: any): boolean {
  return isAppError(error) && error.code === ERROR_CODES.EXTERNAL_SERVICE_ERROR;
}

// Type exports
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export type ErrorCategory =
  (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES];
export type ErrorSeverity =
  (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY];
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// Legacy alias for compatibility
export const ErrorTypes = ERROR_CODES;
