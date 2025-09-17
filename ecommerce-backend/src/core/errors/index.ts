// Export all error classes
export * from "./app-error";
export * from "./error-types";
export * from "./error-handler";

// Re-export commonly used items with shorter names
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  BusinessLogicError,
} from "./app-error";

export {
  ERROR_CODES,
  HTTP_STATUS,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  type ErrorResponse,
  type SuccessResponse,
  type ApiResponse,
  type ErrorContext,
} from "./error-types.js";

export {
  ErrorHandler,
  createErrorHandler,
  defaultErrorHandler,
  asyncHandler,
  withErrorBoundary,
} from "./error-handler.js";
