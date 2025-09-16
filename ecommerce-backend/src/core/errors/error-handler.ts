import { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { AppError, ValidationError, DatabaseError } from "./app-error.js";
import {
  ERROR_CODES,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  HTTP_STATUS,
  DATABASE_ERROR_MAPPING,
  DEFAULT_ERROR_CONFIG,
  type ErrorContext,
  type ErrorLogEntry,
  type ErrorResponse,
  type ErrorHandlerConfig,
} from "./error-types.js";

/**
 * Global error handler for Fastify applications
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private logger: any; // Will be injected

  constructor(config: Partial<ErrorHandlerConfig> = {}, logger?: any) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * Main error handler middleware
   */
  public handle = async (
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const correlationId = this.getCorrelationId(request);
    const context = this.buildErrorContext(request, correlationId);

    // Convert error to AppError if needed
    const appError = this.normalizeError(error, correlationId);

    // Log the error
    if (this.config.logErrors) {
      this.logError(appError, context);
    }

    // Build error response
    const errorResponse = this.buildErrorResponse(appError, context);

    // Set response status and send
    reply.status(appError.statusCode).send(errorResponse);
  };

  /**
   * Normalize any error to AppError
   */
  private normalizeError(error: Error, correlationId?: string): AppError {
    // Already an AppError
    if (error instanceof AppError) {
      return error;
    }

    // Zod validation error
    if (error instanceof ZodError) {
      return new ValidationError(
        "Validation failed",
        this.formatZodErrors(error),
        correlationId
      );
    }

    // Fastify validation error
    if (this.isFastifyValidationError(error)) {
      return new ValidationError(
        error.message,
        { validation: (error as any).validation },
        correlationId
      );
    }

    // Database errors (PostgreSQL)
    if (this.isDatabaseError(error)) {
      return this.handleDatabaseError(error, correlationId);
    }

    // Rate limit error
    if (this.isRateLimitError(error)) {
      return new AppError(
        "Rate limit exceeded",
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        undefined,
        correlationId
      );
    }

    // File upload errors
    if (this.isFileUploadError(error)) {
      return new AppError(
        "File upload failed",
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
        ERROR_CODES.FILE_UPLOAD_ERROR,
        { originalError: error.message },
        correlationId
      );
    }

    // JWT errors
    if (this.isJWTError(error)) {
      return new AppError(
        "Authentication failed",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN,
        undefined,
        correlationId
      );
    }

    // Generic server error
    return new AppError(
      this.config.sanitizeErrors ? "Internal server error" : error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      this.config.sanitizeErrors ? undefined : { originalError: error.message },
      correlationId
    );
  }

  /**
   * Handle database-specific errors
   */
  private handleDatabaseError(
    error: Error,
    correlationId?: string
  ): DatabaseError {
    const message = error.message;
    let errorCode: string = ERROR_CODES.DATABASE_ERROR;
    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;

    // Check for specific PostgreSQL error codes
    const pgError = error as any;
    if (
      pgError.code &&
      DATABASE_ERROR_MAPPING[
        pgError.code as keyof typeof DATABASE_ERROR_MAPPING
      ]
    ) {
      const mappedCode =
        DATABASE_ERROR_MAPPING[
          pgError.code as keyof typeof DATABASE_ERROR_MAPPING
        ];

      // Adjust status code based on error type
      if (mappedCode === ERROR_CODES.RESOURCE_EXISTS) {
        statusCode = HTTP_STATUS.CONFLICT;
        errorCode = mappedCode;
      } else if (
        mappedCode === ERROR_CODES.MISSING_REQUIRED_FIELD ||
        mappedCode === ERROR_CODES.VALIDATION_ERROR
      ) {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        errorCode = mappedCode;
      } else {
        errorCode = mappedCode;
      }
    }

    return new DatabaseError(
      this.config.sanitizeErrors ? "Database operation failed" : message,
      {
        code: pgError.code,
        detail: this.config.sanitizeErrors ? undefined : pgError.detail,
        constraint: pgError.constraint,
      },
      correlationId
    );
  }

  /**
   * Build error context from request
   */
  private buildErrorContext(
    request: FastifyRequest,
    correlationId?: string
  ): ErrorContext {
    return {
      correlationId,
      userId: (request as any).user?.id,
      vendorId: (request as any).user?.vendorId,
      requestId: request.id,
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      method: request.method,
      url: request.url,
      timestamp: new Date(),
      metadata: {
        params: request.params,
        query: request.query,
        // Don't log sensitive data like body or headers
      },
    };
  }

  /**
   * Build error response for API
   */
  private buildErrorResponse(
    error: AppError,
    context: ErrorContext
  ): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        timestamp: error.timestamp.toISOString(),
        correlationId: error.correlationId,
      },
    };

    // Add details if available and not sanitized
    if (
      error.details &&
      (!this.config.sanitizeErrors || error.statusCode < 500)
    ) {
      response.error.details = this.sanitizeErrorDetails(error.details);
    }

    return response;
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: AppError, context: ErrorContext): void {
    if (!this.logger) return;

    const logEntry: ErrorLogEntry = {
      level: this.getLogLevel(error),
      message: error.message,
      error: error,
      code: error.code,
      statusCode: error.statusCode,
      category: this.getErrorCategory(error),
      severity: this.getErrorSeverity(error),
      context,
      stack: this.config.includeStackTrace ? error.stack : undefined,
      timestamp: new Date(),
    };

    // Log with appropriate level
    switch (logEntry.level) {
      case "error":
        this.logger.error(logEntry);
        break;
      case "warn":
        this.logger.warn(logEntry);
        break;
      case "info":
        this.logger.info(logEntry);
        break;
    }
  }

  /**
   * Get correlation ID from request
   */
  private getCorrelationId(request: FastifyRequest): string | undefined {
    if (!this.config.enableCorrelationId) return undefined;

    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      request.id
    );
  }

  /**
   * Format Zod validation errors
   */
  private formatZodErrors(error: ZodError) {
    return error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
      received: err.code === "invalid_type" ? (err as any).received : undefined,
      expected: err.code === "invalid_type" ? (err as any).expected : undefined,
    }));
  }

  /**
   * Sanitize error details for production
   */
  private sanitizeErrorDetails(details: any): any {
    if (!this.config.sanitizeErrors) return details;

    // Remove sensitive information
    const sanitized = { ...details };

    // Remove common sensitive fields
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
    ];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    });

    // Limit details length
    const detailsString = JSON.stringify(sanitized);
    if (detailsString.length > this.config.maxErrorDetailsLength) {
      return { message: "Error details too large to display" };
    }

    return sanitized;
  }

  /**
   * Determine log level based on error
   */
  private getLogLevel(error: AppError): "error" | "warn" | "info" {
    if (error.statusCode >= 500) return "error";
    if (error.statusCode >= 400) return "warn";
    return "info";
  }

  /**
   * Get error category for monitoring
   */
  private getErrorCategory(error: AppError): string {
    const code = error.code;

    if (code.includes("AUTHENTICATION") || code.includes("AUTHORIZATION")) {
      return ERROR_CATEGORIES.AUTHENTICATION;
    }
    if (code.includes("VALIDATION")) {
      return ERROR_CATEGORIES.VALIDATION;
    }
    if (code.includes("DATABASE")) {
      return ERROR_CATEGORIES.DATABASE;
    }
    if (code.includes("EXTERNAL_SERVICE")) {
      return ERROR_CATEGORIES.EXTERNAL_SERVICE;
    }
    if (code.includes("FILE")) {
      return ERROR_CATEGORIES.FILE_OPERATION;
    }
    if (code.includes("RATE_LIMIT")) {
      return ERROR_CATEGORIES.RATE_LIMITING;
    }
    if (code.includes("BUSINESS_LOGIC")) {
      return ERROR_CATEGORIES.BUSINESS_LOGIC;
    }

    return ERROR_CATEGORIES.UNKNOWN;
  }

  /**
   * Get error severity for alerting
   */
  private getErrorSeverity(error: AppError): string {
    if (error.statusCode >= 500) return ERROR_SEVERITY.HIGH;
    if (error.statusCode === 429) return ERROR_SEVERITY.MEDIUM;
    if (error.statusCode >= 400) return ERROR_SEVERITY.LOW;
    return ERROR_SEVERITY.LOW;
  }

  // Error type detection methods
  private isFastifyValidationError(error: Error): boolean {
    return error.name === "FastifyError" && (error as any).statusCode === 400;
  }

  private isDatabaseError(error: Error): boolean {
    return (
      error.name === "PostgresError" ||
      error.name === "DatabaseError" ||
      (error as any).code?.startsWith?.("23") || // PostgreSQL constraint errors
      (error as any).code?.startsWith?.("42") || // PostgreSQL syntax errors
      (error as any).code?.startsWith?.("08") // PostgreSQL connection errors
    );
  }

  private isRateLimitError(error: Error): boolean {
    return error.name === "FastifyError" && (error as any).statusCode === 429;
  }

  private isFileUploadError(error: Error): boolean {
    return (
      error.name === "FastifyError" &&
      ((error as any).statusCode === 413 || (error as any).statusCode === 415)
    );
  }

  private isJWTError(error: Error): boolean {
    return (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    );
  }
}

/**
 * Create error handler middleware for Fastify
 */
export function createErrorHandler(
  config?: Partial<ErrorHandlerConfig>,
  logger?: any
) {
  const handler = new ErrorHandler(config, logger);
  return handler.handle;
}

/**
 * Default error handler instance
 */
export const defaultErrorHandler = new ErrorHandler();

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Re-throw the error to be caught by the global error handler
      throw error;
    }
  };
}

/**
 * Error boundary for service methods
 */
export function withErrorBoundary<T extends any[], R>(
  fn: (...args: T) => R | Promise<R>,
  errorTransformer?: (error: Error) => AppError
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (errorTransformer && !(error instanceof AppError)) {
        throw errorTransformer(error as Error);
      }
      throw error;
    }
  };
}
