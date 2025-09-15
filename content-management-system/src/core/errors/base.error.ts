/**
 * Base error class for all application errors
 * Provides a consistent interface and structure for error handling
 */
export abstract class BaseError extends Error {
  /**
   * Unique error code for this error type
   */
  abstract readonly code: string;

  /**
   * HTTP status code associated with this error
   */
  abstract readonly statusCode: number;

  /**
   * Whether this error is operational (expected) or programming error
   */
  public readonly isOperational: boolean = true;

  /**
   * Additional context or metadata about the error
   */
  public readonly context?: Record<string, unknown>;

  /**
   * Timestamp when the error occurred
   */
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace, excluding constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      ...(process.env.NODE_ENV === "development" && {
        stack: this.stack,
        cause: this.cause,
      }),
    };
  }

  /**
   * Convert error to string representation
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }

  /**
   * Check if an error is a BaseError instance
   */
  static isBaseError(error: unknown): error is BaseError {
    return error instanceof BaseError;
  }

  /**
   * Check if an error is operational
   */
  static isOperational(error: unknown): boolean {
    if (BaseError.isBaseError(error)) {
      return error.isOperational;
    }
    return false;
  }
}

/**
 * Error for client-side errors (4xx status codes)
 */
export abstract class ClientError extends BaseError {
  public readonly isOperational = true;
}

/**
 * Error for server-side errors (5xx status codes)
 */
export abstract class ServerError extends BaseError {
  public readonly isOperational = false;
}

/**
 * Error for business logic violations
 */
export abstract class BusinessError extends ClientError {
  // Business errors are operational by nature
}

/**
 * Error for technical/infrastructure issues
 */
export abstract class TechnicalError extends ServerError {
  // Technical errors are typically not operational
}
