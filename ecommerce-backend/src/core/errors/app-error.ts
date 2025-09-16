/**
 * Base application error class
 * Provides structured error handling with proper HTTP status codes and error details
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any,
    correlationId?: string
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode();
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date();
    this.correlationId = correlationId;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private getDefaultCode(): string {
    const statusCode = this.statusCode;

    if (statusCode >= 400 && statusCode < 500) {
      return "CLIENT_ERROR";
    }

    if (statusCode >= 500) {
      return "SERVER_ERROR";
    }

    return "UNKNOWN_ERROR";
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
        correlationId: this.correlationId,
      },
    };
  }

  /**
   * Check if error is operational (expected) vs programming error
   */
  static isOperational(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }
}

/**
 * Validation error - 400 Bad Request
 */
export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    details?: any,
    correlationId?: string
  ) {
    super(message, 400, "VALIDATION_ERROR", details, correlationId);
  }
}

/**
 * Authentication error - 401 Unauthorized
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = "Authentication failed",
    details?: any,
    correlationId?: string
  ) {
    super(message, 401, "AUTHENTICATION_ERROR", details, correlationId);
  }
}

/**
 * Authorization error - 403 Forbidden
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = "Access denied",
    details?: any,
    correlationId?: string
  ) {
    super(message, 403, "AUTHORIZATION_ERROR", details, correlationId);
  }
}

/**
 * Not found error - 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    details?: any,
    correlationId?: string
  ) {
    super(message, 404, "NOT_FOUND", details, correlationId);
  }
}

/**
 * Conflict error - 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(
    message: string = "Resource conflict",
    details?: any,
    correlationId?: string
  ) {
    super(message, 409, "CONFLICT", details, correlationId);
  }
}

/**
 * Rate limit error - 429 Too Many Requests
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = "Rate limit exceeded",
    details?: any,
    correlationId?: string
  ) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", details, correlationId);
  }
}

/**
 * Database error - 500 Internal Server Error
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = "Database operation failed",
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, "DATABASE_ERROR", details, correlationId);
  }
}

/**
 * External service error - 502 Bad Gateway
 */
export class ExternalServiceError extends AppError {
  constructor(
    message: string = "External service error",
    details?: any,
    correlationId?: string
  ) {
    super(message, 502, "EXTERNAL_SERVICE_ERROR", details, correlationId);
  }
}

/**
 * Service unavailable error - 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = "Service temporarily unavailable",
    details?: any,
    correlationId?: string
  ) {
    super(message, 503, "SERVICE_UNAVAILABLE", details, correlationId);
  }
}

/**
 * Business logic error - 422 Unprocessable Entity
 */
export class BusinessLogicError extends AppError {
  constructor(
    message: string = "Business rule violation",
    details?: any,
    correlationId?: string
  ) {
    super(message, 422, "BUSINESS_LOGIC_ERROR", details, correlationId);
  }
}

/**
 * File upload error - 413 Payload Too Large or 415 Unsupported Media Type
 */
export class FileUploadError extends AppError {
  constructor(
    message: string = "File upload failed",
    statusCode: number = 413,
    details?: any,
    correlationId?: string
  ) {
    super(message, statusCode, "FILE_UPLOAD_ERROR", details, correlationId);
  }
}

/**
 * Payment error - 402 Payment Required
 */
export class PaymentError extends AppError {
  constructor(
    message: string = "Payment processing failed",
    details?: any,
    correlationId?: string
  ) {
    super(message, 402, "PAYMENT_ERROR", details, correlationId);
  }
}

/**
 * Timeout error - 408 Request Timeout
 */
export class TimeoutError extends AppError {
  constructor(
    message: string = "Request timeout",
    details?: any,
    correlationId?: string
  ) {
    super(message, 408, "TIMEOUT_ERROR", details, correlationId);
  }
}

/**
 * Maintenance mode error - 503 Service Unavailable
 */
export class MaintenanceError extends AppError {
  constructor(
    message: string = "System under maintenance",
    details?: any,
    correlationId?: string
  ) {
    super(message, 503, "MAINTENANCE_MODE", details, correlationId);
  }
}
