// Base error classes
export * from "./base.error";

// Specific error types
export * from "./validation.error";
export * from "./not-found.error";
export * from "./database.error";
export * from "./auth.error";
export * from "./business.error";

// Re-export for convenience
export {
  BaseError,
  ClientError,
  ServerError,
  BusinessError,
  TechnicalError,
} from "./base.error";

export { ValidationError } from "./validation.error";

export { NotFoundError } from "./not-found.error";

export {
  DatabaseError,
  ConnectionError,
  QueryError,
  ConstraintError,
  TransactionError,
  MigrationError,
} from "./database.error";

export { AuthenticationError, AuthorizationError } from "./auth.error";

export {
  BusinessRuleError,
  ConflictError,
  LimitExceededError,
  PreconditionError,
} from "./business.error";

/**
 * Type guard to check if an error is a BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Type guard to check if an error is operational
 */
export function isOperationalError(error: unknown): boolean {
  return isBaseError(error) && error.isOperational;
}

/**
 * Extract error information for logging/monitoring
 */
export function extractErrorInfo(error: unknown): {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  isOperational: boolean;
  context?: Record<string, unknown>;
  stack?: string;
} {
  if (isBaseError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      isOperational: false,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
    isOperational: false,
  };
}
