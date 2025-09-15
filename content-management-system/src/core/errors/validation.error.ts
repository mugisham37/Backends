import { ClientError } from "./base.error";

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends ClientError {
  public readonly code = "VALIDATION_ERROR";
  public readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      field,
      value,
      ...context,
    });
  }

  /**
   * Create a validation error for a specific field
   */
  static forField(
    field: string,
    message: string,
    value?: unknown,
    cause?: unknown
  ): ValidationError {
    return new ValidationError(
      `Validation failed for field '${field}': ${message}`,
      field,
      value,
      cause
    );
  }

  /**
   * Create a validation error for required field
   */
  static required(field: string): ValidationError {
    return ValidationError.forField(field, "This field is required");
  }

  /**
   * Create a validation error for invalid format
   */
  static invalidFormat(
    field: string,
    expectedFormat: string,
    value?: unknown
  ): ValidationError {
    return ValidationError.forField(
      field,
      `Invalid format. Expected: ${expectedFormat}`,
      value
    );
  }

  /**
   * Create a validation error for invalid length
   */
  static invalidLength(
    field: string,
    min?: number,
    max?: number,
    actual?: number
  ): ValidationError {
    let message = "Invalid length";
    if (min !== undefined && max !== undefined) {
      message = `Length must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `Length must be at least ${min}`;
    } else if (max !== undefined) {
      message = `Length must be at most ${max}`;
    }

    if (actual !== undefined) {
      message += `. Got: ${actual}`;
    }

    return ValidationError.forField(field, message, actual);
  }

  /**
   * Create a validation error for invalid range
   */
  static invalidRange(
    field: string,
    min?: number,
    max?: number,
    value?: unknown
  ): ValidationError {
    let message = "Value out of range";
    if (min !== undefined && max !== undefined) {
      message = `Value must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `Value must be at least ${min}`;
    } else if (max !== undefined) {
      message = `Value must be at most ${max}`;
    }

    return ValidationError.forField(field, message, value);
  }

  /**
   * Create a validation error for invalid enum value
   */
  static invalidEnum(
    field: string,
    allowedValues: readonly string[],
    value?: unknown
  ): ValidationError {
    const message = `Invalid value. Allowed values: ${allowedValues.join(
      ", "
    )}`;
    return ValidationError.forField(field, message, value);
  }

  /**
   * Create a validation error for multiple fields
   */
  static multiple(errors: ValidationError[]): ValidationError {
    const fields = errors.map((e) => e.field).filter(Boolean);
    const messages = errors.map((e) => e.message);

    return new ValidationError(
      `Multiple validation errors: ${messages.join("; ")}`,
      undefined,
      undefined,
      undefined,
      { fields, errors: errors.map((e) => e.toJSON()) }
    );
  }
}
