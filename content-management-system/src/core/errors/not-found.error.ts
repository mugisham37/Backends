import { ClientError } from "./base.error";

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends ClientError {
  public readonly code = "NOT_FOUND";
  public readonly statusCode = 404;

  constructor(
    message: string,
    public readonly resource?: string,
    public readonly identifier?: string | number,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      resource,
      identifier,
      ...context,
    });
  }

  /**
   * Create a not found error for a specific resource
   */
  static forResource(
    resource: string,
    identifier?: string | number,
    cause?: unknown
  ): NotFoundError {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    return new NotFoundError(message, resource, identifier, cause);
  }

  /**
   * Create a not found error for a user
   */
  static user(identifier?: string | number): NotFoundError {
    return NotFoundError.forResource("User", identifier);
  }

  /**
   * Create a not found error for content
   */
  static content(identifier?: string | number): NotFoundError {
    return NotFoundError.forResource("Content", identifier);
  }

  /**
   * Create a not found error for a tenant
   */
  static tenant(identifier?: string | number): NotFoundError {
    return NotFoundError.forResource("Tenant", identifier);
  }

  /**
   * Create a not found error for media
   */
  static media(identifier?: string | number): NotFoundError {
    return NotFoundError.forResource("Media", identifier);
  }

  /**
   * Create a not found error for an API endpoint
   */
  static endpoint(path: string): NotFoundError {
    return new NotFoundError(`Endpoint '${path}' not found`, "Endpoint", path);
  }

  /**
   * Create a not found error for a file
   */
  static file(path: string): NotFoundError {
    return new NotFoundError(`File '${path}' not found`, "File", path);
  }

  /**
   * Create a not found error for a database record
   */
  static record(
    table: string,
    identifier?: string | number,
    cause?: unknown
  ): NotFoundError {
    return NotFoundError.forResource(`Record in ${table}`, identifier, cause);
  }
}
