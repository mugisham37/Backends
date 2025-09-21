// Base error classes
export * from "./base.error";

// Specific error types
export * from "./validation.error";
export * from "./not-found.error";
export * from "./database.error";
export * from "./auth.error";
export * from "./business.error";

// Import for use in functions
import { BaseError } from "./base.error";

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
  code?: string | undefined;
  statusCode?: number | undefined;
  isOperational: boolean;
  context?: Record<string, unknown> | undefined;
  stack?: string | undefined;
} {
  if (isBaseError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code || undefined,
      statusCode: error.statusCode || undefined,
      isOperational: error.isOperational,
      context: error.context || undefined,
      stack: error.stack || undefined,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      isOperational: false,
      stack: error.stack || undefined,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
    isOperational: false,
  };
}

/**
 * Create a Fastify error handler with configurable options
 */
export function createErrorHandler(
  options: {
    logErrors?: boolean;
    includeStackTrace?: boolean;
    sanitizeErrors?: boolean;
  } = {},
  logger?: any
) {
  const {
    logErrors = true,
    includeStackTrace = false,
    sanitizeErrors = true,
  } = options;

  return async (error: any, request: any, reply: any) => {
    const errorInfo = extractErrorInfo(error);

    // Log the error if enabled
    if (logErrors && logger) {
      logger.error("Request error occurred", {
        error: errorInfo,
        request: {
          method: request.method,
          url: request.url,
          headers: sanitizeErrors ? undefined : request.headers,
        },
      });
    }

    // Determine response status code
    const statusCode = errorInfo.statusCode || error.statusCode || 500;

    // Build error response
    const errorResponse: any = {
      error: true,
      message: errorInfo.message,
      timestamp: new Date().toISOString(),
    };

    // Add error code if available
    if (errorInfo.code) {
      errorResponse.code = errorInfo.code;
    }

    // Add stack trace in development
    if (includeStackTrace && errorInfo.stack) {
      errorResponse.stack = errorInfo.stack;
    }

    // Add context if available and not sanitizing
    if (!sanitizeErrors && errorInfo.context) {
      errorResponse.context = errorInfo.context;
    }

    return reply.status(statusCode).send(errorResponse);
  };
}
